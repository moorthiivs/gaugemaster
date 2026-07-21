import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGoogleLogin } from '@react-oauth/google';
import httpClient from '@/lib/httpClient';

interface ExcelEditorModalProps {
  open: boolean;
  fileUrl: string;
  instrumentId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ExcelEditorModal({ open, fileUrl, instrumentId, onClose, onSaved }: ExcelEditorModalProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  const loginAndUpload = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/drive.file',
    onSuccess: async (tokenResponse) => {
      setGoogleAccessToken(tokenResponse.access_token);
      await handleUploadToDrive(tokenResponse.access_token);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Google Login Failed', variant: 'destructive' });
    },
  });

  const handleUploadToDrive = async (accessToken: string) => {
    setUploading(true);
    try {
      const response = await httpClient.post(`/instruments/${instrumentId}/google-sheet/upload`, {
        accessToken,
        fileUrl,
      });

      setSpreadsheetId(response.data.spreadsheetId);
      
      // Open Google Sheets in new tab
      window.open(response.data.webViewLink, '_blank');
      
      toast({ title: 'Success', description: 'Opened in Google Sheets. Click Sync Changes when done.', variant: 'success' });
    } catch (error) {
      console.error('Drive upload error', error);
      toast({ title: 'Error', description: 'Failed to upload to Google Drive', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSyncChanges = async () => {
    if (!googleAccessToken || !spreadsheetId) return;
    
    setSyncing(true);
    try {
      await httpClient.post(`/instruments/${instrumentId}/google-sheet/sync`, {
        accessToken: googleAccessToken,
        spreadsheetId,
      });

      toast({ title: 'Success', description: 'Changes synced back from Google Sheets!', variant: 'success' });
      onSaved();
    } catch (error) {
      console.error('Drive sync error', error);
      toast({ title: 'Error', description: 'Failed to sync from Google Drive', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleClose = () => {
    // Reset state on close
    setSpreadsheetId(null);
    setGoogleAccessToken(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Certificate in Google Sheets</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 flex flex-col items-center gap-4 text-center">
          {!spreadsheetId ? (
            <>
              <p className="text-sm text-muted-foreground">
                Click below to sign in with Google and open this certificate in Google Sheets.
              </p>
              <Button onClick={() => loginAndUpload()} disabled={uploading}>
                {uploading ? 'Uploading to Drive...' : 'Open with Google Sheets'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                The certificate has been opened in Google Sheets in a new tab.
                When you are finished editing, click the button below to sync the changes back.
              </p>
              <Button onClick={handleSyncChanges} disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync Changes & Save'}
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading || syncing}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
