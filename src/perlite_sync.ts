import { TFile } from 'obsidian';
import { getPerliteVaultByAddress, PerliteVaultDir } from './server/perlite_server';
import { PerliteVault } from './server/perlite_server';
import { MnemonicWallet } from './mnemonic-wallet';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, NET_WORK } from './constant';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SealUtil } from './utils/sealUtil';

export async function init(vaultName: string, address: string, wallet: MnemonicWallet): Promise<PerliteVault | undefined> {
    //初始化，先获取到vault的名称，去链上找到该钱包是否有该vault,有就提示同步，否则，提示链上无对应对象，需要先上传
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
            (async () => {
                let txBytes = await tx.build({ client: suiClient });
                // 
                let signature = await wallet.signTransaction(txBytes);
                suiClient.getOwnedObjects
                let txResult = await suiClient.executeTransactionBlock({
                    transactionBlock: txBytes,
                    signature: signature,
                });
                console.log("txResult", txResult);
                
            })();
        } catch (e) {
            console.log("tx build error", e);
        }
        return await getPerliteVaultByAddress(address, vaultName);
    }else{
        return vault;
    }
}

export async function push(vault: PerliteVault, vaultLocalPath: string, allMarkdownFiles: TFile[], wallet: MnemonicWallet) {
    //上传，先获取到vault的名称，去链上找到该钱包是否有该vault, 没有就直接上传
    console.log("push vault", vault.name, vaultLocalPath);
    let address = wallet.getAddress();
    console.log("query vault", vault);
    console.log("allMarkdownFiles", allMarkdownFiles);
    console.log("vault", vault);
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
                            wallet: this.mnemonicWallet
                        };
        const { handleSubmit, displayUpload, handlePublish } = SealUtil(props);
        
        for(let j=0; j<allMarkdownFiles.length; j++){
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
                        console.log("has dir", tempPath);
                        parentObjMap.set(tempPath+"/"+currFilePathSplit[i+1], newDirMap.get(tempPath));
                        continue;
                    }

                    let parent = parentObjMap.get(tempPath);
                    console.log("process dir ", currDir);
                    let par = tx.moveCall({
                        package: PACKAGE_ID,
                        module: 'perlite_sync',
                        function: 'new_directory',
                        arguments: [tx.pure.string(currDir), tx.object(parent), tx.object("0x6")],
                    });
                    newDirMap.set(tempPath, par);
                    parentObjMap.set(tempPath+"/"+currFilePathSplit[i+1], par);
                    waitTransferDirs.push(par);
                }
                console.log("parentObjMap", parentObjMap);
                //上传文件
                const fs = require('fs');
                const path = require('path');
                const sourcePath = path.join(vaultLocalPath, file.path);
                let parent_dir = parentObjMap.get(file.path);
                const data = fs.readFileSync(sourcePath);
                const fileName = path.basename(sourcePath);
                console.log("fileName", fileName);
                const result = await handleSubmit(new File([data], fileName, {
                    type: 'text/plain',
                    lastModified: Date.now()
                }));
                if (result) {
                    console.log("文件上传成功:", sourcePath);
                    let fileResult = tx.moveCall({
                        target: PACKAGE_ID+'::perlite_sync::new_file',
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

        const suiClient = new SuiClient({ url: getFullnodeUrl(NET_WORK) });
        try {
            let txBytes = await tx.build({ client: suiClient });
            let signature = await wallet.signTransaction(txBytes);
            let txResult = await suiClient.executeTransactionBlock({
                transactionBlock: txBytes,
                signature: signature,
            })
            console.log("process dir, txResult", txResult);
        } catch (e) {
            console.log("tx build error", e);
            throw e;
        }
        console.log("mkdir done");


    }

    allMarkdownFiles.forEach(file => {
        console.log(file.path);
    })

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

function pull() {
    //下载，先获取到vault的名称，去链上找到该钱包是否有该vault, 没有，就不下载
    //有，判断是否有更新
}