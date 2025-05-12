import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { graphql } from '@mysten/sui/graphql/schemas/latest';
import { DIR_TYPE, FILE_TYPE, GRAPHQL_URL } from 'src/constant';
export type Directory = {
  id: string,
  name: string,
  parent: string,
  is_root: boolean,
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
  end_epoch: number,
  created_at: Date,
  updated_at: Date,
}
export type FlatFile = {
  id: string, // 目录ID
  name: string, // 目录名称
  is_file: boolean, // 是否是文件
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
export async function getPerliteVaultByAddress(address: string, vaultName: string): Promise<PerliteVault | undefined> {
  let dirs = await getUserOwnDirectory(address, GRAPHQL_URL);
  if (dirs.length == 0) {
    return undefined;
  }
  let files = await getUserOwnFile(address, GRAPHQL_URL);
  const dirMap = new Map<string, Directory>();
  const parentMap = new Map<string, Directory[]>();
  const fileMap = new Map<string, File[]>();
  // 处理目录
  dirs.forEach(dir => {
    dirMap.set(dir.id, dir);

    if (!parentMap.has(dir.parent)) {
      parentMap.set(dir.parent, []);
    }
    parentMap.get(dir.parent)!.push(dir);
  });

  // 处理文件
  files.forEach(file => {
    if (!fileMap.has(file.belong_dir)) {
      fileMap.set(file.belong_dir, []);
    }
    fileMap.get(file.belong_dir)!.push(file);
  });

  // 2. 递归构建目录结构
  const buildDirectory = (dirId: string): PerliteVaultDir => {
    const dir = dirMap.get(dirId)!;
    // 获取子目录（已排序）
    const childDirs = (parentMap.get(dirId) || [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(d => buildDirectory(d.id));

    // 获取文件（已排序）
    const files = (fileMap.get(dirId) || [])
      .sort((a, b) => a.title.localeCompare(b.title));

    return {
      ...dir,
      directories: childDirs,
      files,
    };
  };

  // 3. 构建根目录（假设只有一个根目录）
  const rootDir = dirs.find(d => d.is_root && d.name == vaultName)!;
  if (!rootDir) {
    return undefined;
  }
  const dir = buildDirectory(rootDir.id);
  if (dir) {
    return {
      id: dir.id, // 保险库自身ID
      name: dir.name,
      directories: dir.directories,
      files: dir.files, // 根目录层级的文件（如果有需要可以添加对应逻辑）
      created_at: rootDir.created_at,
      updated_at: rootDir.updated_at,
    };
  } else {
    return undefined;
  }

}
async function getUserOwnDirectory(address: string, graphqlUrl: string): Promise<Array<Directory>> {
  let result: Array<Directory> = new Array();
  const suiGraphQLClient = new SuiGraphQLClient({
    url: graphqlUrl,
  })
  const type = DIR_TYPE;
  let dataResult = await suiGraphQLClient.query({
    query: queryByAddressAndType,
    variables: {
      address,
      type: type,
    },
  });
  if (dataResult.data?.address?.objects?.edges.length == 0) {
    return result;
  }
  const dirs = dataResult.data?.address?.objects?.edges.map(edge => edge.node.contents?.json as {
    id: string,
    name: string,
    parent: string,
    is_root: boolean,
    created_at: number,
    updated_at: number,
  });

  dirs?.forEach(dir => {
    result.push({
      id: dir.id,
      name: dir.name,
      parent: dir.parent,
      is_root: dir.is_root,
      created_at: new Date(dir.created_at),
      updated_at: new Date(dir.updated_at),
    })
  })
  return result;
}

async function getUserOwnFile(address: string, graphqlUrl: string): Promise<Array<File>> {
  let result: Array<File> = new Array();
  const suiGraphQLClient = new SuiGraphQLClient({
    url: graphqlUrl,
  })
  const type = FILE_TYPE;
  let dataResult = await suiGraphQLClient.query({
    query: queryByAddressAndType,
    variables: {
      address,
      type: type,
    },
  });
  if (dataResult.data?.address?.objects?.edges.length == 0) {
    return result;
  }
  const files = dataResult.data?.address?.objects?.edges.map(edge => edge.node.contents?.json as {
    id: string,
    title: string,
    belong_dir: string,
    blob_id: string,
    end_epoch: number,
    created_at: number,
    updated_at: number,
  });

  files?.forEach(file => {
    result.push({
      id: file.id,
      title: file.title,
      belong_dir: file.belong_dir,
      blob_id: file.blob_id,
      end_epoch: file.end_epoch,
      created_at: new Date(file.created_at),
      updated_at: new Date(file.updated_at),
    })
  })
  return result;
}