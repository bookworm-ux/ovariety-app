import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { LabAttachment } from '@/lib/health-types';

const LAB_PDF_DIRECTORY = 'lab-results';
export const MAX_LAB_PDF_BYTES = 4 * 1024 * 1024;

export interface PendingLabPdf {
  name: string;
  size?: number;
  uri: string;
}

export async function pickLabPdf(): Promise<PendingLabPdf | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
    base64: true,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  const isPdf = asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('Choose a PDF file.');
  if (asset.size !== undefined && asset.size > MAX_LAB_PDF_BYTES) {
    throw new Error('Choose a PDF smaller than 4 MB.');
  }

  return { name: asset.name, size: asset.size, uri: asset.uri };
}

export async function saveLabPdf(pendingPdf: PendingLabPdf, labId: string): Promise<LabAttachment> {
  if (Platform.OS === 'web') {
    return {
      name: pendingPdf.name,
      mimeType: 'application/pdf',
      size: pendingPdf.size,
      uri: pendingPdf.uri,
    };
  }

  const directory = new Directory(Paths.document, LAB_PDF_DIRECTORY);
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${labId}.pdf`);
  await new File(pendingPdf.uri).copy(destination);

  return {
    name: pendingPdf.name,
    mimeType: 'application/pdf',
    size: pendingPdf.size,
    uri: destination.uri,
  };
}

export function deleteStoredLabPdfs() {
  if (Platform.OS === 'web') return;
  const directory = new Directory(Paths.document, LAB_PDF_DIRECTORY);
  if (directory.exists) directory.delete();
}
