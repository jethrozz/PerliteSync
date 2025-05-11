import { TFile } from 'obsidian';
import {getPerliteVaultByAddress} from './server/perlite_server';
import {PerliteVault} from './server/perlite_server';
import { MnemonicWallet } from './mnemonic-wallet';
import { Transaction } from '@mysten/sui/dist/cjs/transactions';
import { PACKAGE_ID } from './constant';

export async function init(vaultName: string, address: string) {
    //初始化，先获取到vault的名称，去链上找到该钱包是否有该vault,有就提示同步，否则，提示链上无对应对象，需要先上传

   let vault : PerliteVault| undefined = await getPerliteVaultByAddress(address, vaultName);


}

export async function push(vaultName: string, vaultLocalPath: string, allMarkdownFiles: TFile[], wallet : MnemonicWallet) {
    //上传，先获取到vault的名称，去链上找到该钱包是否有该vault, 没有就直接上传
    let address = wallet.getAddress();
    let vault : PerliteVault | undefined = await getPerliteVaultByAddress(address, vaultName);
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
        
    }
    //有，判断是否有更新，删除已上传的，上传新的
    //判断依据，文件的hash值是否相同，不同就上传，相同就跳过
}


function pull() {
    //下载，先获取到vault的名称，去链上找到该钱包是否有该vault, 没有，就不下载
    //有，判断是否有更新
}