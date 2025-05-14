import { EncryptedObject, getAllowlistedKeyServers, NoAccessError, SealClient , SessionKey } from '@mysten/seal';
import { fromBase64, fromHex, toBase64, toHex } from '@mysten/sui/utils';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { MnemonicWallet } from '../mnemonic-wallet';
import { DataAdapter } from 'obsidian';
import { PACKAGE_ID } from '../constant';
import {File as PerliteFile} from '../server/perlite_server';
type WalrusService = {
    id: string;
    name: string;
    publisherUrl: string;
    aggregatorUrl: string;
};
export type MoveCallConstructor = (tx: Transaction, id: string) => void;

export type Data = {
    status: string;
    blobId: string;
    endEpoch: number;
    suiRefType: string;
    suiRef: string;
    suiBaseUrl: string;
    blobUrl: string;
    suiUrl: string;
    isImage: string;
};

interface WalrusUploadProps {
    vaultId: string;
    moduleName: string;
    packageId: string;
    wallet: MnemonicWallet;
}

export function SealUtil({ vaultId, moduleName, packageId, wallet}: WalrusUploadProps) {
    const SUI_VIEW_TX_URL = `https://suiscan.xyz/testnet/tx`;
    const SUI_VIEW_OBJECT_URL = `https://suiscan.xyz/testnet/object`;

    const services: WalrusService[] = [
        {
            id: 'service1',
            name: 'walrus.space',
            publisherUrl: 'https://walrus.space/publisher',
            aggregatorUrl: 'https://walrus.space/aggregator',
        },
        {
            id: 'service2',
            name: 'staketab.org',
            publisherUrl: 'https://staketab.org/publisher',
            aggregatorUrl: 'https://staketab.org/aggregator',
        },
        {
            id: 'service3',
            name: 'redundex.com',
            publisherUrl: 'https://redundex.com/publisher',
            aggregatorUrl: 'https://redundex.com/aggregator',
        },
        {
            id: 'service4',
            name: 'nodes.guru',
            publisherUrl: 'https://nodes.guru/publisher',
            aggregatorUrl: 'https://nodes.guru/aggregator',
        },
        {
            id: 'service5',
            name: 'banansen.dev',
            publisherUrl: 'https://banansen.dev/publisher',
            aggregatorUrl: 'https://banansen.dev/aggregator',
        },
        {
            id: 'service6',
            name: 'everstake.one',
            publisherUrl: 'https://everstake.one/publisher',
            aggregatorUrl: 'https://everstake.one/aggregator',
        },
    ];
    const NUM_EPOCH = 1;
    let selectedService = services[0].id;
    function getAggregatorUrl(path: string): string {
        const service = services.find((s) => s.id === selectedService);
        const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
        return `${service?.aggregatorUrl.replace(/\/+$/, '')}/v1/${cleanPath}`;
    }

    function getPublisherUrl(path: string): string {
        const service = services.find((s) => s.id === selectedService);
        const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
        return `${service?.publisherUrl.replace(/\/+$/, '')}/v1/${cleanPath}`;
    }

    const handleSubmit = async (file: File, epoch: number): Promise<Data> => {
        if (!file) {
            throw new Error('No file selected');
        }

        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async (event) => {
                try {
                    if (!event.target?.result || !(event.target.result instanceof ArrayBuffer)) {
                        throw new Error('Invalid file data');
                    }
                    const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
                    const client = new SealClient({
                        suiClient,
                        serverObjectIds: getAllowlistedKeyServers('testnet'),
                        verifyKeyServers: false,
                    });
                    const nonce = crypto.getRandomValues(new Uint8Array(5));
                    const policyObjectBytes = fromHex(vaultId);
                    const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));
                    const { encryptedObject: encryptedBytes } = await client.encrypt({
                        threshold: 2,
                        packageId,
                        id,
                        data: new Uint8Array(event.target.result),
                    });
                    const storageInfo = await storeBlob(encryptedBytes, epoch);
                    if(storageInfo){
                        resolve(displayUpload(storageInfo.info, file.type));
                    }else{
                        reject(new Error('Failed to store blob'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    };

    const storeBlob = async(encryptedData: Uint8Array, epoch: number) => {
        let urls = ["https://publisher.walrus-testnet.walrus.space",
            "https://wal-publisher-testnet.staketab.org",
            "https://walrus-testnet-publisher.bartestnet.com",
            "https://walrus-testnet-publisher.nodes.guru",
            "https://sui-walrus-testnet.bwarelabs.com/publisher",
            "https://walrus-testnet-publisher.stakin-nodes.com",
            "https://testnet-publisher-walrus.kiliglab.io",
            "https://walrus-testnet-publisher.nodeinfra.com",
            "https://walrus-testnet.blockscope.net:11444",
            "https://walrus-publish-testnet.chainode.tech:9003",
            "https://walrus-testnet-publisher.starduststaking.com:11445",
            "http://walrus-publisher-testnet.overclock.run:9001",
            "http://walrus-testnet-publisher.everstake.one:9001",
            "http://walrus.testnet.pops.one:9001",
            "http://ivory-dakar-e5812.walrus.bdnodes.net:9001",
            "http://publisher.testnet.sui.rpcpool.com:9001",
            "http://walrus.krates.ai:9001",
            "http://walrus-publisher-testnet.latitude-sui.com:9001",
            "http://walrus-tn.juicystake.io:9090",
            "http://walrus-testnet.stakingdefenseleague.com:9001",
            "http://walrus.sui.thepassivetrust.com:9001",
        ]
        for (let url of urls) {
            try{
                console.log("try to store blob on", url);
                const response = await fetch(url +"/v1/blobs?epochs="+epoch, {
                    method: 'PUT',
                    body: encryptedData,
                });
                
                if (response.status === 200) {
                    const info = await response.json();
                    return { info };
                }
            }catch(e){
                console.error("Error publishing the blob on Walrus, please select a different Walrus service. try next url", e);
            }
        }
        return null;
    };

    const displayUpload = (storage_info: any, media_type: any): Data => {
        let info: Data;
        if ('alreadyCertified' in storage_info) {
            info = {
                status: 'Already certified',
                blobId: storage_info.alreadyCertified.blobId,
                endEpoch: storage_info.alreadyCertified.endEpoch,
                suiRefType: 'Previous Sui Certified Event',
                suiRef: storage_info.alreadyCertified.event.txDigest,
                suiBaseUrl: SUI_VIEW_TX_URL,
                blobUrl: getAggregatorUrl(`/v1/blobs/${storage_info.alreadyCertified.blobId}`),
                suiUrl: `${SUI_VIEW_OBJECT_URL}/${storage_info.alreadyCertified.event.txDigest}`,
                isImage: media_type.startsWith('image'),
            };
        } else if ('newlyCreated' in storage_info) {
            info = {
                status: 'Newly created',
                blobId: storage_info.newlyCreated.blobObject.blobId,
                endEpoch: storage_info.newlyCreated.blobObject.storage.endEpoch,
                suiRefType: 'Associated Sui Object',
                suiRef: storage_info.newlyCreated.blobObject.id,
                suiBaseUrl: SUI_VIEW_OBJECT_URL,
                blobUrl: getAggregatorUrl(`/v1/blobs/${storage_info.newlyCreated.blobObject.blobId}`),
                suiUrl: `${SUI_VIEW_OBJECT_URL}/${storage_info.newlyCreated.blobObject.id}`,
                isImage: media_type.startsWith('image'),
            };
        } else {
            throw Error('Unhandled successful response!');
        }
        console.log("displayUpload", info);
        return info;
    };

    async function handlePublish(title: string, end_epoch: number, parent_dir: string, blob_id: string) {
        const tx = new Transaction();
        tx.setSender(wallet.getAddress());
        let fileResult = tx.moveCall({
            target: PACKAGE_ID+'::perlite_sync::new_file',
            arguments: [tx.pure.string(title), tx.pure.string(blob_id), tx.pure.u64(end_epoch), tx.object(parent_dir), tx.object("0x6")],
        });

        tx.moveCall({
            target: `${PACKAGE_ID}::perlite_sync::transfer_file`,
            arguments: [tx.object(fileResult), tx.pure.address(wallet.getAddress())],
        });
        tx.setGasBudget(10000000);
        const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
        try {
            (async () => {
                let txBytes = await tx.build({ client: suiClient });
                // 
                let signature = await wallet.signTransaction(txBytes);

                let txResult = await suiClient.executeTransactionBlock({
                    transactionBlock: txBytes,
                    signature: signature,
                });
                console.log(" publish file txResult", txResult);
            })();
        } catch (e) {
            console.log("tx build error", e);
        }
    }

    async function downloadFile(file: PerliteFile, filePath: string, adapter: DataAdapter) {
        const TTL_MIN = 10;
        const sessionKey = new SessionKey({
            address: wallet.getAddress(),
            packageId,
            ttlMin: TTL_MIN,
        });

        try {
            const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
            const client = new SealClient({
                suiClient,
                serverObjectIds: getAllowlistedKeyServers('testnet'),
                verifyKeyServers: false,
            });
            let message = sessionKey.getPersonalMessage();
            let signature = await wallet.signPersonalMessage(message);
            const moveCallConstructor = await constructMoveCall(packageId, file.id);

            await sessionKey.setPersonalMessageSignature(signature);
            const blobs = await downloadAndDecrypt(
                adapter,
                [file.blob_id],
                sessionKey,
                suiClient,
                client,
                moveCallConstructor
            );
            for(let i=0; i<blobs.length; i++){
                const blob = blobs[i];
                await saveToLocal(adapter, blob, filePath);
            }
        } catch (error: any) {
            console.error('Error:', error);
        }
    }


    async function downloadAndDecrypt(
        adapter: DataAdapter,
        blobIds: string[],
        sessionKey: SessionKey,
        suiClient: SuiClient,
        sealClient: SealClient,
        moveCallConstructor: (tx: Transaction, id: string) => void,
    ): Promise<Blob[]>{
        //
        const aggregators = ['https://aggregator.walrus-testnet.walrus.space',
          'https://wal-aggregator-testnet.staketab.org',
          'https://walrus-testnet-aggregator.bartestnet.com', 
          'https://walrus-testnet.blockscope.net', 
          'https://walrus-testnet-aggregator.nodes.guru', 
          'https://walrus-cache-testnet.overclock.run',
          'https://sui-walrus-testnet.bwarelabs.com/aggregator',
          'https://walrus-testnet-aggregator.stakin-nodes.com',
          'https://testnet-aggregator-walrus.kiliglab.io',
          'https://walrus-cache-testnet.latitude-sui.com',
          'https://walrus-testnet-aggregator.nodeinfra.com',
          'https://walrus-tn.juicystake.io:9443',
          'https://walrus-agg-testnet.chainode.tech:9002',
          'https://walrus-testnet-aggregator.starduststaking.com:11444',
          'http://walrus-testnet-aggregator.everstake.one:9000',
          'http://walrus.testnet.pops.one:9000',
          'http://scarlet-brussels-376c2.walrus.bdnodes.net:9000',
          'http://aggregator.testnet.sui.rpcpool.com:9000',
          'http://walrus.krates.ai:9000',
          'http://walrus-testnet.stakingdefenseleague.com:9000',
          'http://walrus.sui.thepassivetrust.com:9000'];
        // First, download all files in parallel (ignore errors)
        const blobs: Blob[] = [];

        const downloadResults = await Promise.all(
            blobIds.map(async (blobId) => {
                for (let aggregator of aggregators) {
                    try {
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 10000);
                        const aggregatorUrl = `${aggregator}/v1/blobs/${blobId}`;
                        const response = await fetch(aggregatorUrl, { signal: controller.signal });
                        clearTimeout(timeout);
                        if (!response.ok) {
                            continue;
                        }
                        return await response.arrayBuffer();
                    } catch (err) {
                        console.error(`Blob ${blobId} cannot be retrieved from Walrus`, err);
                        continue;
                    }
                }
                return null;
            }),
        );

        // Filter out failed downloads
        const validDownloads = downloadResults.filter((result): result is ArrayBuffer => result !== null);
        console.log('validDownloads count', validDownloads.length);

        if (validDownloads.length === 0) {
            const errorMsg =
                'Cannot retrieve files from this Walrus aggregator, try again (a randomly selected aggregator will be used). Files uploaded more than 1 epoch ago have been deleted from Walrus.';
            console.error(errorMsg);
            return blobs;
        }

        // Fetch keys in batches of <=10
        for (let i = 0; i < validDownloads.length; i += 10) {
            const batch = validDownloads.slice(i, i + 10);
            const ids = batch.map((enc) => EncryptedObject.parse(new Uint8Array(enc)).id);
            const tx = new Transaction();
            ids.forEach((id) => moveCallConstructor(tx, id));
            const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
            try {
                await sealClient.fetchKeys({ ids, txBytes, sessionKey, threshold: 2 });
            } catch (err) {
                console.log(err);
                const errorMsg =
                    err instanceof NoAccessError
                        ? 'No access to decryption keys'
                        : 'Unable to decrypt files, try again';
                console.error(errorMsg, err);
                return blobs;
            }
        }

        // Then, decrypt files sequentially
        for (const encryptedData of validDownloads) {
            const fullId = EncryptedObject.parse(new Uint8Array(encryptedData)).id;
            const tx = new Transaction();
            moveCallConstructor(tx, fullId);
            const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });
            try {
                // Note that all keys are fetched above, so this only local decryption is done
                const decryptedFile = await sealClient.decrypt({
                    data: new Uint8Array(encryptedData),
                    sessionKey,
                    txBytes,
                });
                // 将解密后的文件内容转换为文本
                const blob = new Blob([decryptedFile], { type: 'text/markdown' });
                console.log('blob', blob);
                blobs.push(blob);
            } catch (err) {
                console.log(err);
                const errorMsg =
                    err instanceof NoAccessError
                        ? 'No access to decryption keys'
                        : 'Unable to decrypt files, try again';
                console.error(errorMsg, err);
                return blobs;
            }
        }
        return blobs;
    };

    function constructMoveCall(packageId: string, fileId: string): MoveCallConstructor {
        return (tx: Transaction, id: string) => {
            tx.moveCall({
                target: PACKAGE_ID+`::perlite_sync::seal_approve`,
                arguments: [tx.pure.vector('u8', fromHex(id)), tx.object(fileId)],
            });
        };
    }

    async function saveToLocal(adapter: DataAdapter, blob: Blob, filePath: string) {
        try {
            const path = require('path');
            // 确保输出目录存在
            const arrayBuffer = await blob.arrayBuffer();
            adapter.writeBinary(filePath, arrayBuffer);

            console.log(`文件已保存到: ${filePath}`);
        } catch (error) {
            console.error('保存文件失败:', error);
            throw error;
        }
    };
    // 添加return语句暴露方法
    return {
        handleSubmit,
        displayUpload,
        downloadFile,
        handlePublish: (title: string, end_epoch: number, parent_dir: string, blob_id: string) => 
            handlePublish(title, end_epoch, parent_dir, blob_id)
    };
}

