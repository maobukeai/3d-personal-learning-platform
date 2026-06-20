import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { logger } from './logger';

export interface WebDAVFile {
  name: string;
  size: number;
  lastModified: Date;
}

export class WebDAVClient {
  private client: AxiosInstance;
  private dir: string;

  constructor(url: string, username: string, passwordSecret: string, dir: string) {
    // Ensure URL has a trailing slash
    const baseUrl = url.endsWith('/') ? url : `${url}/`;
    this.dir = dir.replace(/^\/+|\/+$/g, ''); // strip leading/trailing slashes

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${username}:${passwordSecret}`).toString('base64'),
        'Accept': '*/*',
      },
      // Do not throw on 404 for folder existence checks, we handle it manually
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    });
  }

  /**
   * Check connection to WebDAV service
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.client.request({
        method: 'PROPFIND',
        url: '',
        headers: { 'Depth': '0' },
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('认证失败，请检查账号和应用密码');
      }
      if (response.status !== 200 && response.status !== 207) {
        throw new Error(`连接失败，HTTP 状态码: ${response.status}`);
      }
      return true;
    } catch (err: any) {
      logger.error('[WebDAV] Connection check failed:', err.message);
      throw new Error(err.message || 'WebDAV 服务连接失败，请检查服务地址和网络');
    }
  }

  /**
   * Ensure that the remote directory exists, create it if not
   */
  async ensureDirExists(): Promise<void> {
    if (!this.dir) return;

    try {
      // Check if folder exists
      const response = await this.client.request({
        method: 'PROPFIND',
        url: `${encodeURIComponent(this.dir)}/`,
        headers: { 'Depth': '0' },
      });

      if (response.status === 404) {
        logger.info(`[WebDAV] Directory '${this.dir}' not found. Creating...`);
        
        // We will split the directory path in case it is nested
        const parts = this.dir.split('/');
        let currentPath = '';
        for (const part of parts) {
          if (!part) continue;
          currentPath = currentPath ? `${currentPath}/${encodeURIComponent(part)}` : encodeURIComponent(part);
          const checkSub = await this.client.request({
            method: 'PROPFIND',
            url: `${currentPath}/`,
            headers: { 'Depth': '0' },
          });
          if (checkSub.status === 404) {
            const mkcolRes = await this.client.request({
              method: 'MKCOL',
              url: `${currentPath}/`,
            });
            if (mkcolRes.status !== 201) {
              throw new Error(`创建文件夹失败，HTTP 状态码: ${mkcolRes.status}`);
            }
          }
        }
      }
    } catch (err: any) {
      logger.error(`[WebDAV] ensureDirExists failed: ${err.message}`);
      throw new Error(`远端目录初始化失败: ${err.message}`);
    }
  }

  /**
   * Upload file to WebDAV
   */
  async uploadFile(filename: string, fileBuffer: Buffer): Promise<void> {
    await this.ensureDirExists();
    const url = this.dir ? `${encodeURIComponent(this.dir)}/${encodeURIComponent(filename)}` : encodeURIComponent(filename);
    try {
      const response = await this.client.put(url, fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP 状态码: ${response.status}`);
      }
    } catch (err: any) {
      logger.error(`[WebDAV] Upload failed for ${filename}: ${err.message}`);
      throw new Error(`上传文件到 WebDAV 失败: ${err.message}`);
    }
  }

  /**
   * Download file from WebDAV
   */
  async downloadFile(filename: string): Promise<Buffer> {
    const url = this.dir ? `${encodeURIComponent(this.dir)}/${encodeURIComponent(filename)}` : encodeURIComponent(filename);
    try {
      const response = await this.client.get(url, {
        responseType: 'arraybuffer',
      });
      if (response.status === 404) {
        throw new Error('文件在远端服务器上不存在');
      }
      return Buffer.from(response.data);
    } catch (err: any) {
      logger.error(`[WebDAV] Download failed for ${filename}: ${err.message}`);
      throw new Error(`从 WebDAV 下载文件失败: ${err.message}`);
    }
  }

  /**
   * Delete file on WebDAV
   */
  async deleteFile(filename: string): Promise<void> {
    const url = this.dir ? `${encodeURIComponent(this.dir)}/${encodeURIComponent(filename)}` : encodeURIComponent(filename);
    try {
      const response = await this.client.delete(url);
      if (response.status === 404) {
        logger.warn(`[WebDAV] File ${filename} already deleted or not found.`);
        return;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP 状态码: ${response.status}`);
      }
    } catch (err: any) {
      logger.error(`[WebDAV] Delete failed for ${filename}: ${err.message}`);
      throw new Error(`从 WebDAV 删除文件失败: ${err.message}`);
    }
  }

  /**
   * List files in WebDAV directory
   */
  async listFiles(): Promise<WebDAVFile[]> {
    await this.ensureDirExists();
    const url = this.dir ? `${encodeURIComponent(this.dir)}/` : '';
    try {
      const response = await this.client.request({
        method: 'PROPFIND',
        url,
        headers: { 'Depth': '1' },
      });

      if (response.status === 404) {
        return [];
      }

      const xml = response.data;
      const $ = cheerio.load(xml, { xmlMode: true });
      const files: WebDAVFile[] = [];

      // WebDAV tags are case-sensitive and namespaces can vary (d:response, D:response, response, etc.)
      // We will look for elements matching response
      $('response, d\\:response, D\\:response').each((_: number, elem: any) => {
        const href = $(elem).find('href, d\\:href, D\\:href').text();
        const decodedHref = decodeURIComponent(href);
        const basename = path.basename(decodedHref);

        // Check if it's a directory (collection)
        const isCollection = $(elem).find('resourcetype, d\\:resourcetype, D\\:resourcetype').find('collection, d\\:collection, D\\:collection').length > 0;
        
        // Skip directories and empty file names
        if (isCollection || !basename) {
          return;
        }

        const sizeStr = $(elem).find('getcontentlength, d\\:getcontentlength, D\\:getcontentlength').text();
        const size = sizeStr ? parseInt(sizeStr, 10) : 0;
        
        const lastModStr = $(elem).find('getlastmodified, d\\:getlastmodified, D\\:getlastmodified').text();
        const lastModified = lastModStr ? new Date(lastModStr) : new Date();

        files.push({
          name: basename,
          size,
          lastModified,
        });
      });

      return files;
    } catch (err: any) {
      logger.error(`[WebDAV] List files failed: ${err.message}`);
      throw new Error(`获取远端备份列表失败: ${err.message}`);
    }
  }
}
