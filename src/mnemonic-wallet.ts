import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toBase64 } from '@mysten/sui/utils';

interface mnemoninWallet{
    mnemonic: string;
    address: string;
    privateKey: string;
    publicKey: string;
}


export class MnemonicWallet implements mnemoninWallet{
    mnemonic: string;
    address: string;
    privateKey: string;
    publicKey: string;

    constructor(mnemonic: string){
        this.mnemonic = mnemonic;
        // 生成密钥对
        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        // 获取私钥
        const privateKey = keypair.getSecretKey();
        console.log('Private Key:', privateKey.toString());

        // 获取公钥
        const publicKey = keypair.getPublicKey();
        console.log('Public Key:', publicKey.toSuiAddress());
        this.address = publicKey.toSuiAddress();
        this.privateKey = privateKey;
        this.publicKey = toBase64(publicKey.toRawBytes());
    }

    getAddress(): string{
        return this.address;
    }

    // sign(message: string): string{
    //     const keypair = Ed25519Keypair.deriveKeypair(this.mnemonic);
    //     const signature = keypair.sign(message);
    //     return signature;
    // }

}

