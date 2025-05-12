import { TFile } from 'obsidian';
import {getPerliteVaultByAddress, PerliteVaultDir} from './server/perlite_server';
import {PerliteVault} from './server/perlite_server';
import { MnemonicWallet } from './mnemonic-wallet';
import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, NET_WORK } from './constant';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SealUtil } from './utils/sealUtil';

export async function init(vaultName: string, address: string) {
    //初始化，先获取到vault的名称，去链上找到该钱包是否有该vault,有就提示同步，否则，提示链上无对应对象，需要先上传

   let vault : PerliteVault| undefined = await getPerliteVaultByAddress(address, vaultName);


}

export async function push(vaultName: string, vaultLocalPath: string, allMarkdownFiles: TFile[], wallet : MnemonicWallet) {
    //上传，先获取到vault的名称，去链上找到该钱包是否有该vault, 没有就直接上传
    console.log("push vault", vaultName, vaultLocalPath);
    let address = wallet.getAddress();
    let vault : PerliteVault | undefined = await getPerliteVaultByAddress(address, vaultName);
    console.log("query vault", vault);
    console.log("allMarkdownFiles", allMarkdownFiles);
    if(vault){
        let vaultId = vault.id;
        let map = flattenVaultFilesOptimized(vault);
        console.log("vaultMap", map);
        allMarkdownFiles.forEach(file => {
            if(map.has(file.path)){
                //该文件已上传
                console.log("has file", file.path);
            }else{
                //该文件未上传
                let currFilePathSplit = file.path.split("/");
                let currFile = currFilePathSplit[currFilePathSplit.length - 1];
                
                let tx = new Transaction();

                let txResult = null;
                let newDirMap = new Map<string, boolean>();
                let tempPath = "";
                for(let i=0; i<currFilePathSplit.length-1; i++){
                    let currDir = currFilePathSplit[i];
                    if (tempPath == ""){
                        tempPath = currDir;
                    }else{
                        tempPath = tempPath + "/" + currDir;
                    }

                    if (newDirMap.has(tempPath)){
                        continue;
                    }else{
                        newDirMap.set(tempPath, true);
                    }
                    let par = null;
                    if(txResult){
                        par = tx.moveCall({
                            package: PACKAGE_ID,
                            module: 'perlite_sync',
                            function: 'new_directory',
                            arguments: [tx.pure.string(currDir), tx.object(txResult)],
                        });
                    }else {
                        par = tx.moveCall({
                            package: PACKAGE_ID,
                            module: 'perlite_sync',
                            function: 'new_directory',
                            arguments: [tx.pure.string(currDir), tx.object(vault.id)],
                        });
                    }
                    tx.moveCall({
                        package: PACKAGE_ID,
                        module: 'perlite_sync',
                        function: 'transfer_dir',
                        arguments: [tx.object(par), tx.pure.address(address)],
                    });
                    txResult = par; 
                }
                const suiClient = new SuiClient({ url: getFullnodeUrl(NET_WORK) });
                try {
                    (async () => {
                        let txBytes = await tx.build({ client: suiClient });
                        let signature = await wallet.signTransaction(txBytes);
                        let txResult = await suiClient.executeTransactionBlock({
                            transactionBlock: txBytes,
                            signature: signature,
                        })
                        console.log("push txResult", txResult);
                    })
                } catch (e) {
                    console.log("tx build error", e);
                    throw e;
                }


                //上传文件
                let props = {
                    vaultId: vault.id,
                    moduleName: 'perlite_sync',
                    wallet: this.mnemonicWallet
                };
                const { handleSubmit, displayUpload, handlePublish } = SealUtil(props);
                const fs = require('fs');
                const path = require('path');
                const sourcePath = path.join(vaultLocalPath, file.path);
                fs.readFile(sourcePath, async (err: any, data: any) => {
                    if (err) {
                        console.error("读取文件失败:", err);
                        return;
                    }
                    const fileName = path.basename(sourcePath);
                    let file = new File([data], fileName, {
                        type: 'text/plain',
                        lastModified: Date.now()
                    });
                    console.log("文件内容:", file);
                    const result = await handleSubmit(file);
                    //发布文件
                    handlePublish(props.vaultId, result.endEpoch, currFile, result.blobId);
                    if (result) {
                        console.log("文件上传成功:", result);
                    }
                });


            }
        })

        vault = await getPerliteVaultByAddress(address, vaultName);
        if(!vault){
            throw new Error("get vault failed");
        }
        map = flattenVaultFilesOptimized(vault);

        allMarkdownFiles.forEach(file => {
            if (map.has(file.path)) {
                //该文件已上传
                console.log("has file", file.path);
            } else {
                //该文件未上传
                //上传文件
                let props = {
                    vaultId: vaultId,
                    moduleName: 'perlite_sync',
                    wallet: this.mnemonicWallet
                };
                const { handleSubmit, displayUpload, handlePublish } = SealUtil(props);
                const fs = require('fs');
                const path = require('path');
                const sourcePath = path.join(vaultLocalPath, file.path);
                fs.readFile(sourcePath, async (err: any, data: any) => {
                    if (err) {
                        console.error("读取文件失败:", err);
                        return;
                    }
                    const fileName = path.basename(sourcePath);
                    let file = new File([data], fileName, {
                        type: 'text/plain',
                        lastModified: Date.now()
                    });
                    console.log("文件内容:", file);
                    const result = await handleSubmit(file);
                    //发布文件
                    handlePublish(props.vaultId, result.endEpoch, currFile, result.blobId);
                    if (result) {
                        console.log("文件上传成功:", result);
                    }
                });


            }
        })
    }
    
    allMarkdownFiles.forEach(file => {
        console.log(file.path);
    })
    if(!vault){
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
        //上传文件

        const suiClient = new SuiClient({ url: getFullnodeUrl(NET_WORK) });
        try {
            (async () => {
                let txBytes = await tx.build({ client: suiClient });
                // 
                let signature = await wallet.signTransaction(txBytes);

                let txResult = await suiClient.executeTransactionBlock({
                    transactionBlock: txBytes,
                    signature: signature,
                });
                console.log("txResult", txResult);
            })();
        } catch (e) {
            console.log("tx build error", e);
        }
    }
    //有，判断是否有更新，删除已上传的，上传新的
    //判断依据，文件的hash值是否相同，不同就上传，相同就跳过
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
        pathSegments.push(file.title+".md");
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