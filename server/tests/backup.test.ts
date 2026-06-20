import axios from 'axios';
import { WebDAVClient } from '../src/utils/webdav';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebDAVClient', () => {
  let mockRequest: jest.Mock;
  let mockPut: jest.Mock;
  let mockGet: jest.Mock;
  let mockDelete: jest.Mock;
  let client: WebDAVClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = jest.fn();
    mockPut = jest.fn();
    mockGet = jest.fn();
    mockDelete = jest.fn();

    mockedAxios.create.mockReturnValue({
      request: mockRequest,
      put: mockPut,
      get: mockGet,
      delete: mockDelete,
    } as any);

    client = new WebDAVClient('https://example.com/dav', 'test-user', 'test-pass', 'test-dir');
  });

  describe('checkConnection', () => {
    it('should return true if WebDAV returns 200', async () => {
      mockRequest.mockResolvedValue({ status: 200 });
      const result = await client.checkConnection();
      expect(result).toBe(true);
      expect(mockRequest).toHaveBeenCalledWith({
        method: 'PROPFIND',
        url: '',
        headers: { Depth: '0' },
      });
    });

    it('should throw authentication error if WebDAV returns 401', async () => {
      mockRequest.mockResolvedValue({ status: 401 });
      await expect(client.checkConnection()).rejects.toThrow('认证失败，请检查账号和应用密码');
    });

    it('should throw connection error if WebDAV returns non-200/207 status', async () => {
      mockRequest.mockResolvedValue({ status: 500 });
      await expect(client.checkConnection()).rejects.toThrow('连接失败，HTTP 状态码: 500');
    });
  });

  describe('ensureDirExists', () => {
    it('should do nothing if directory already exists', async () => {
      mockRequest.mockResolvedValue({ status: 200 }); // Directory exists
      await client.ensureDirExists();
      expect(mockRequest).toHaveBeenCalledWith({
        method: 'PROPFIND',
        url: 'test-dir/',
        headers: { Depth: '0' },
      });
      // Should not call MKCOL since status is 200
      expect(mockRequest).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'MKCOL' }));
    });

    it('should call MKCOL to create folder if PROPFIND returns 404', async () => {
      mockRequest
        .mockResolvedValueOnce({ status: 404 }) // Directory test-dir check
        .mockResolvedValueOnce({ status: 404 }) // Directory parents check
        .mockResolvedValueOnce({ status: 201 }); // MKCOL success

      await client.ensureDirExists();
      expect(mockRequest).toHaveBeenNthCalledWith(1, {
        method: 'PROPFIND',
        url: 'test-dir/',
        headers: { Depth: '0' },
      });
      expect(mockRequest).toHaveBeenNthCalledWith(3, {
        method: 'MKCOL',
        url: 'test-dir/',
      });
    });
  });

  describe('uploadFile', () => {
    it('should put file buffer to WebDAV', async () => {
      mockRequest.mockResolvedValue({ status: 200 }); // directory exists check
      mockPut.mockResolvedValue({ status: 201 });
      
      const buffer = Buffer.from('hello world');
      await client.uploadFile('test.txt', buffer);
      
      expect(mockPut).toHaveBeenCalledWith('test-dir/test.txt', buffer, {
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    });

    it('should throw error if PUT status is not successful', async () => {
      mockRequest.mockResolvedValue({ status: 200 }); // directory exists check
      mockPut.mockResolvedValue({ status: 500 });
      
      const buffer = Buffer.from('hello world');
      await expect(client.uploadFile('test.txt', buffer)).rejects.toThrow('上传文件到 WebDAV 失败: HTTP 状态码: 500');
    });
  });

  describe('downloadFile', () => {
    it('should return file buffer if download is successful', async () => {
      mockGet.mockResolvedValue({ status: 200, data: Buffer.from('my data') });
      
      const data = await client.downloadFile('test.txt');
      expect(data.toString()).toBe('my data');
      expect(mockGet).toHaveBeenCalledWith('test-dir/test.txt', { responseType: 'arraybuffer' });
    });

    it('should throw error if file is not found', async () => {
      mockGet.mockResolvedValue({ status: 404 });
      await expect(client.downloadFile('test.txt')).rejects.toThrow('从 WebDAV 下载文件失败: 文件在远端服务器上不存在');
    });
  });

  describe('deleteFile', () => {
    it('should call delete on WebDAV url', async () => {
      mockDelete.mockResolvedValue({ status: 204 });
      await client.deleteFile('test.txt');
      expect(mockDelete).toHaveBeenCalledWith('test-dir/test.txt');
    });
  });

  describe('listFiles', () => {
    it('should return list of WebDAVFile objects from WebDAV XML response', async () => {
      mockRequest
        .mockResolvedValueOnce({ status: 200 }) // Directory exists check
        .mockResolvedValueOnce({
          status: 207,
          data: `<?xml version="1.0" encoding="utf-8" ?>
            <d:multistatus xmlns:d="DAV:">
              <d:response>
                <d:href>/dav/test-dir/</d:href>
                <d:propstat>
                  <d:prop>
                    <d:resourcetype><d:collection/></d:resourcetype>
                  </d:prop>
                  <d:status>HTTP/1.1 200 OK</d:status>
                </d:propstat>
              </d:response>
              <d:response>
                <d:href>/dav/test-dir/backup1.zip</d:href>
                <d:propstat>
                  <d:prop>
                    <d:getcontentlength>12345</d:getcontentlength>
                    <d:getlastmodified>Fri, 19 Jun 2026 20:30:00 GMT</d:getlastmodified>
                    <d:resourcetype/>
                  </d:prop>
                  <d:status>HTTP/1.1 200 OK</d:status>
                </d:propstat>
              </d:response>
            </d:multistatus>`,
        });

      const list = await client.listFiles();
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        name: 'backup1.zip',
        size: 12345,
        lastModified: new Date('Fri, 19 Jun 2026 20:30:00 GMT'),
      });
    });
  });
});
