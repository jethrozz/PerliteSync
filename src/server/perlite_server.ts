import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { graphql } from '@mysten/sui/graphql/schemas/latest';

export type Directory = {
    id: string,
    name: string,
    parent: string,
    is_root: boolean,
    files: Array<string>,
    directories: Array<string>,
    created_at: Date,
    updated_at: Date,
}
export type PerliteVault = {
    id: string,
    name: string,
    directories: Array<PerliteVaultDir>,
    files: Array<File>,
    created_at: Date,
    updated_at: Date,
}
export type PerliteVaultDir = {
    id: string,
    name: string,
    directories: Array<PerliteVaultDir>,
    files: Array<File>,
    created_at: Date,
    updated_at: Date,
}

export type File = {
    id: string,
    title: string,
    belong_dir: string,
    blob_id: string,
    end_epoch: string,
    created_at: Date,
    updated_at: Date,
}


const queryByAddressAndType = graphql(`
    query($address: SuiAddress!, $type: String!) {
      address(address: $address) {
        objects(filter: { type: $type }) {
          edges {
            node {
              contents {
                json
              }
            }
          }
        }
      }
    }
  `);
export async function getPerliteVaultByAddress(address: string, vaultName: string, graphqlUrl: string): Promise<PerliteVault> {
    let dirs = await getUserOwnDirectory(address, graphqlUrl);
    let files = await getUserOwnFile(address, graphqlUrl);
    let rootDir = dirs.find(dir => dir.is_root === true && dir.name === vaultName);
    if (rootDir) {
        let containsDirs = rootDir.directories;
        const vault: PerliteVault = {
            id: rootDir.id,
            name: rootDir.name,
            directories: new Array<PerliteVaultDir>(),
            files: new Array<File>(),
            created_at: rootDir.created_at,
            updated_at: rootDir.updated_at
        };
        //封装一个递归函数，遍历vault下的子目录和文件并返回封装
        for (let i = 0; i < containsDirs.length; i++){
            let dir = getPerliteVaultDir(containsDirs[i], dirs, files);
            if(dir){
                vault.directories.push(dir);
            }
        }
        return vault;
    } else {
        throw new Error(`未找到is_root为true且名称为${vaultName}的目录`);
    }
}

async function getUserOwnDirectory(address: string, graphqlUrl: string): Promise<Array<Directory>> {
    let result: Array<Directory> = new Array();
    const suiGraphQLClient = new SuiGraphQLClient({
        url: graphqlUrl,
    })
    const type = "";
    let dataResult = await suiGraphQLClient.query({
        query: queryByAddressAndType,
        variables: {
            address,
            type: type,
        },
    });

    const dirs = dataResult.data?.address?.objects?.edges.map(edge => edge.node.contents?.json);
    return result;
}

async function getUserOwnFile(address: string, graphqlUrl: string): Promise<Array<File>> {
    let result: Array<File> = new Array();
    const suiGraphQLClient = new SuiGraphQLClient({
        url: graphqlUrl,
    })
    const type = "";
    let dataResult = await suiGraphQLClient.query({
        query: queryByAddressAndType,
        variables: {
            address,
            type: type,
        },
    });

    const files = dataResult.data?.address?.objects?.edges.map(edge => edge.node.contents?.json);
    return result;
}

function getPerliteVaultDir(dirId: string, dirs: Array<Directory>, files: Array<File>): PerliteVaultDir | undefined {
    let dir = dirs.find(dir => dir.id === dirId);
    if (dir) {
        let perliteVaultDir: PerliteVaultDir = {
            id: dir.id,
            name: dir.name,
            directories: new Array<PerliteVaultDir>(),
            files: new Array<File>(),
            created_at: dir.created_at,
            updated_at: dir.updated_at
        }
        dir.directories.forEach(dirId => {
           let child_dir =  getPerliteVaultDir(dirId, dirs, files);
           if(child_dir){
               perliteVaultDir.directories.push(child_dir);
           }
        })
        dir.files.forEach(fileId => {
            let child_file = getPerliteVaultFile(fileId, files);
            if(child_file){
                perliteVaultDir.files.push(child_file);
            }
        })
        return perliteVaultDir;
    }
}

function getPerliteVaultFile(fileId: string, files: Array<File>): File | undefined {
    let file = files.find(file => file.id === fileId);
    if (file) {
        return file;
    }
}