
export interface GoogleDriveFolder {
  id: string;
  name: string;
}

export class GoogleDriveService {
  private accessToken: string | null = null;
  private rootFolderId: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    if (!this.accessToken) throw new Error('Google Drive not connected');
    
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.accessToken}`);
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Google Drive API error');
    }
    
    return response.json();
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    const query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${parentId ? ` and '${parentId}' in parents` : ''}`;
    const data = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`);
    
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // Create folder
    const body = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    };

    const newFolder = await this.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    return newFolder.id;
  }

  async ensureRootFolder(): Promise<string> {
    if (this.rootFolderId) return this.rootFolderId;
    this.rootFolderId = await this.findOrCreateFolder('ExoMind');
    return this.rootFolderId;
  }

  async getSubfolderId(typeName: string): Promise<string> {
    const rootId = await this.ensureRootFolder();
    const folderName = this.getFolderNameByType(typeName);
    return this.findOrCreateFolder(folderName, rootId);
  }

  private getFolderNameByType(type: string): string {
    switch (type) {
      case 'photo': return 'Fotos';
      case 'audio': return 'Áudios';
      case 'video': return 'Vídeos';
      case 'location': return 'Localizações';
      case 'schedule': return 'Agendas';
      default: return 'Notas';
    }
  }

  async uploadFile(name: string, mimeType: string, content: Blob | string, metadata?: any): Promise<string> {
    const type = metadata?.type || 'text';
    const folderId = await this.getSubfolderId(type);
    
    // Check if file exists to update it instead of creating duplicates
    const query = `name = '${name}' and '${folderId}' in parents and trashed = false`;
    const searchData = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`);
    const existingFileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    const fileMetadata = {
      name,
      parents: existingFileId ? undefined : [folderId],
      description: metadata?.summary || metadata?.description || '',
      appProperties: {
        exoId: metadata?.id || '',
        exoType: metadata?.type || ''
      }
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    let body: any;
    let contentType: string;

    if (content instanceof Blob) {
      // Multipart upload for media
      const reader = new FileReader();
      const base64Content = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(content);
      });

      contentType = `multipart/related; boundary=${boundary}`;
      body = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Content +
        closeDelimiter;
    } else {
      // Simple upload for text/json
      contentType = `multipart/related; boundary=${boundary}`;
      body = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n` +
        content +
        closeDelimiter;
    }

    const url = existingFileId 
      ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const result = await this.fetchWithAuth(url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': contentType },
      body
    });

    return result.id;
  }

  async deleteFile(name: string, type: string): Promise<void> {
    try {
      const folderId = await this.getSubfolderId(type);
      const query = `name = '${name}' and '${folderId}' in parents and trashed = false`;
      const searchData = await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`);
      
      if (searchData.files && searchData.files.length > 0) {
        const fileId = searchData.files[0].id;
        await this.fetchWithAuth(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE'
        });
        console.log(`File ${name} deleted from Google Drive`);
      }
    } catch (error) {
      console.error('Error deleting from Google Drive:', error);
    }
  }
}

export const googleDriveService = new GoogleDriveService();
