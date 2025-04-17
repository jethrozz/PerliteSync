import { getAllowlistedKeyServers, SealClient } from '@mysten/seal';
import { fromHex, toHex } from '@mysten/sui/utils';
import { useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

type WalrusService = {
    id: string;
    name: string;
    publisherUrl: string;
    aggregatorUrl: string;
};

export type Data = {
    status: string;
    blobId: string;
    endEpoch: string;
    suiRefType: string;
    suiRef: string;
    suiBaseUrl: string;
    blobUrl: string;
    suiUrl: string;
    isImage: string;
};

interface WalrusUploadProps {
    policyObject: string;
    cap_id: string;
    moduleName: string;
}

const packageId = "0x4cb081457b1e098d566a277f605ba48410e26e66eaab5b3be4f6c560e9501800";

const suiClient = useSuiClient();

const client = new SealClient({
    suiClient,
    serverObjectIds: getAllowlistedKeyServers('testnet'),
    verifyKeyServers: false,
});
const services: WalrusService[] = [
    {
        id: 'service1',
        name: 'walrus.space',
        publisherUrl: '/publisher1',
        aggregatorUrl: '/aggregator1',
    },
    {
        id: 'service2',
        name: 'staketab.org',
        publisherUrl: '/publisher2',
        aggregatorUrl: '/aggregator2',
    },
    {
        id: 'service3',
        name: 'redundex.com',
        publisherUrl: '/publisher3',
        aggregatorUrl: '/aggregator3',
    },
    {
        id: 'service4',
        name: 'nodes.guru',
        publisherUrl: '/publisher4',
        aggregatorUrl: '/aggregator4',
    },
    {
        id: 'service5',
        name: 'banansen.dev',
        publisherUrl: '/publisher5',
        aggregatorUrl: '/aggregator5',
    },
    {
        id: 'service6',
        name: 'everstake.one',
        publisherUrl: '/publisher6',
        aggregatorUrl: '/aggregator6',
    },
];
const NUM_EPOCH = 1;
let selectedService = services[0].id;
function getAggregatorUrl(path: string): string {
    const service = services.find((s) => s.id === selectedService);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${service?.aggregatorUrl}/v1/${cleanPath}`;
  }

  function getPublisherUrl(path: string): string {
    const service = services.find((s) => s.id === selectedService);
    const cleanPath = path.replace(/^\/+/, '').replace(/^v1\//, '');
    return `${service?.publisherUrl}/v1/${cleanPath}`;
  }