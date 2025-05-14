import { App, DataAdapter, TFile, normalizePath } from 'obsidian';
import { getPerliteVaultByAddress, PerliteVaultDir } from './server/perlite_server';
import { PerliteVault } from './server/perlite_server';
import { MnemonicWallet } from './mnemonic-wallet';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, NET_WORK } from './constant';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SealUtil } from './utils/sealUtil';
import { ConfirmModal } from './main';

export async function init(vaultName: string, wallet: MnemonicWallet): Promise<PerliteVault | undefined> {
    //初始化，先获取到vault的名称，去链上找到该钱包是否有该vault,有就提示同步，否则，提示链上无对应对象，需要先上传
    const address = wallet.getAddress();
    let vault: PerliteVault | undefined = await getPerliteVaultByAddress(address, vaultName);
    console.log("init vault", vault);
    if (!vault) {
        //上传
        //先上传目录，先创建一个vault，然后上传目录，上传文件
        const tx = new Transaction();
        tx.setSender(address);
        tx.setGasBudget(10000000);
        const rootDir = tx.moveCall({
            package: PACKAGE_ID,
            module: 'perlite_sync',
            function: 'new_root_directory',
            arguments: [tx.pure.string(vaultName), tx.object("0x6")],
        });
        tx.moveCall({
            package: PACKAGE_ID,
            module: 'perlite_sync',
            function: 'transfer_dir',
            arguments: [tx.object(rootDir), tx.pure.address(address)],
        });
        const suiClient = new SuiClient({ url: getFullnodeUrl(NET_WORK) });
        try {
            let txBytes = await tx.build({ client: suiClient });
            // 
            let signature = await wallet.signTransaction(txBytes);
            suiClient.getOwnedObjects
            let txResult = await suiClient.executeTransactionBlock({
                transactionBlock: txBytes,
                signature: signature,
            });
            console.log("txResult", txResult);
        } catch (e) {
            console.log("tx build error", e);
        }
        return await getPerliteVaultByAddress(address, vaultName);
    } else {
        return vault;
    }
}

export async function push(vault: PerliteVault, vaultLocalPath: string, allMarkdownFiles: TFile[], wallet: MnemonicWallet, epoch: number, noticeFn : (message :string) => void, app: App){
    //上传，先获取到vault的名称，去链上找到该钱包是否有该vault, 没有就直接上传
    console.log("push vault", vault.name, vaultLocalPath);
    let address = wallet.getAddress();
    if (vault) {
        let vaultId = vault.id;
        let map = flattenVaultFilesOptimized(vault);
        console.log("vaultMap", map);
        //先检查目录是否创建，没有就创建
        let newDirMap = new Map<string, any>();
        let waitTransferDirs = [];
        let waitTransferFiles = [];
        let tx = new Transaction();
        tx.setSender(address);
        //tx.setGasBudget(10000000);
        //上传文件
        let props = {
            vaultId: vaultId,
            moduleName: 'perlite_sync',
            wallet: this.mnemonicWallet,
            packageId: PACKAGE_ID,
        };
        const { handleSubmit } = SealUtil(props);

        for (let j = 0; j < allMarkdownFiles.length; j++) {
            let file = allMarkdownFiles[j];
            if (map.has(file.path)) {
                //该文件已上传
                console.log("has file", file.path);
            } else {
                //该文件未上传
                let currFilePathSplit = file.path.split("/");
                let tempPath = "";
                console.log("currFilePathSplit", currFilePathSplit);
                let parentObjMap = new Map<string, any>();

                parentObjMap.set(currFilePathSplit[0], vaultId);
                for (let i = 0; i < currFilePathSplit.length - 1; i++) {
                    let currDir = currFilePathSplit[i];
                    if (tempPath == "") {
                        tempPath = currDir;
                    } else {
                        tempPath = tempPath + "/" + currDir;
                    }
                    if (newDirMap.has(tempPath)) {
                        parentObjMap.set(tempPath + "/" + currFilePathSplit[i + 1], newDirMap.get(tempPath));
                        continue;
                    }
                    let parent = parentObjMap.get(tempPath);
                    noticeFn("正在处理目录：" + tempPath);
                    let par = tx.moveCall({
                        package: PACKAGE_ID,
                        module: 'perlite_sync',
                        function: 'new_directory',
                        arguments: [tx.pure.string(currDir), tx.object(parent), tx.object("0x6")],
                    });
                    newDirMap.set(tempPath, par);
                    parentObjMap.set(tempPath + "/" + currFilePathSplit[i + 1], par);
                    waitTransferDirs.push(par);
                }
                //上传文件
                const fs = require('fs');
                const path = require('path');
                const sourcePath = path.join(vaultLocalPath, file.path);
                let parent_dir = parentObjMap.get(file.path);
                const data = fs.readFileSync(sourcePath);
                const fileName = path.basename(sourcePath);
                console.log("fileName", fileName);
                noticeFn("正在处理文件：" + fileName);
                const result = await handleSubmit(new File([data], fileName, {
                    type: 'text/plain',
                    lastModified: Date.now()
                }), epoch);
                if (result) {
                    noticeFn("文件：" + fileName+" 已保存至walrus");
                    let fileResult = tx.moveCall({
                        target: PACKAGE_ID + '::perlite_sync::new_file',
                        arguments: [tx.pure.string(fileName), tx.pure.string(result.blobId), tx.pure.u64(result.endEpoch), tx.object(parent_dir), tx.object("0x6")],
                    });
                    waitTransferFiles.push(fileResult);
                }
            }
        }
        //处理目录
        waitTransferDirs.forEach(dir => {
            tx.moveCall({
                package: PACKAGE_ID,
                module: 'perlite_sync',
                function: 'transfer_dir',
                arguments: [tx.object(dir), tx.pure.address(address)],
            });
        });
        //处理文件
        waitTransferFiles.forEach(file => {
            tx.moveCall({
                package: PACKAGE_ID,
                module: 'perlite_sync',
                function: 'transfer_file',
                arguments: [tx.object(file), tx.pure.address(address)],
            });
        });
        noticeFn("正在同步数据至链上，请稍后");
        const suiClient = new SuiClient({ url: getFullnodeUrl(NET_WORK) });
        try {
            let txBytes = await tx.build({ client: suiClient });
            let signature = await wallet.signTransaction(txBytes);
            let txResult = await suiClient.executeTransactionBlock({
                transactionBlock: txBytes,
                signature: signature,
            });
            let confirmModal = new ConfirmModal(app, "同步数据上链完成, 本次处理diget: " + txResult.digest + "");
            confirmModal.open();
        } catch (e) {
            noticeFn("发布数据上链异常, 请打开控制台查看详情");
            console.log("tx build error", e);
            throw e;
        }
        console.log("push done");
    }
}

function flattenVaultFilesOptimized(vault: PerliteVault): Map<string, File> {
    const fileMap = new Map();
    const pathSegments: string[] = [];

    function processDir(dir: PerliteVaultDir) {
        pathSegments.push(dir.name);

        // 处理文件
        dir.files.forEach(file => {
            pathSegments.push(file.title + ".md");
            const fullPath = pathSegments.join('/');
            fileMap.set(fullPath, file);
            pathSegments.pop();
        });

        // 处理子目录
        dir.directories.forEach(subDir => {
            processDir(subDir);
        });

        pathSegments.pop();
    }

    // 处理根文件
    vault.files.forEach(file => {
        pathSegments.push(file.title + ".md");
        fileMap.set(pathSegments.join('/'), file);
        pathSegments.pop();
    });

    // 处理目录
    vault.directories.forEach(dir => processDir(dir));

    return fileMap;
}

function flattenVaultDir(vault: PerliteVault): Map<string, string> {
    const dirMap = new Map();
    const pathSegments: string[] = [];

    function processDir(dir: PerliteVaultDir) {
        pathSegments.push(dir.name);
        dirMap.set(pathSegments.join('/'), dir.id);

        // 处理子目录
        dir.directories.forEach(subDir => {
            processDir(subDir);
        });

        pathSegments.pop();
    }

    // 处理根目录
    vault.directories.forEach(dir => processDir(dir));
    return dirMap;
}

export async function pull(vault: PerliteVault, vaultLocalPath: string, allMarkdownFiles: TFile[], wallet: MnemonicWallet, adapter: DataAdapter) {
    //下载，先获取到vault的名称，去链上找到该钱包是否有该vault, 没有，就不下载
    //有，判断是否有更新
    const vaultId = vault.id;
    const props = {
        vaultId: vaultId,
        moduleName: 'perlite_sync',
        wallet: wallet,
        packageId: PACKAGE_ID,
    };

    const { downloadFile } = SealUtil(props);

    const stack: Array<{ dir: PerliteVaultDir, visited: boolean }> = [];
    stack.push({ dir: vault, visited: false });
    const path_join: string[] = [];
    while (stack.length > 0) {
        const entry = stack.pop();
        const currVault = entry?.dir;
        if (currVault) {
            if (!entry?.visited) {
                // 首次访问：构建路径并处理文件
                if (currVault !== vault) {
                    path_join.push(currVault.name);
                }
                const cur_dir_path = [...path_join].join('/');
                const dir_exists = await adapter.exists(cur_dir_path, true);
                if (!dir_exists) {
                    // 目录不存在，创建目录
                    await adapter.mkdir(cur_dir_path);
                }
                // 处理当前目录文件
                for (const file of currVault.files) {
                    const cur_path = [...path_join, file.title].join('/');
                    const exists = await adapter.exists(cur_path, true);
                    // ... 文件处理逻辑保持不变 ...
                    // ... 文件处理逻辑保持不变 ...
                    if (!exists) {
                        // 下载文件
                        console.log("download file", file.title);
                        await downloadFile(file, cur_path, adapter);
                    }
                }
                // 将当前目录标记为已访问，准备后续弹出路径
                stack.push({ dir: currVault, visited: true });

                // 逆向插入子目录保证处理顺序
                for (let i = currVault.directories.length - 1; i >= 0; i--) {
                    stack.push({ dir: currVault.directories[i], visited: false });
                }
            } else {
                // 二次访问：弹出目录路径
                if (currVault !== vault) {
                    path_join.pop();
                }
            }
        }
    }
}