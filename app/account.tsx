import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Card, Input, Label, TextField, Typography } from 'heroui-native';

import { PrivacyNote } from '@/components/HealthNotices';
import { Screen } from '@/components/Screen';
import { useCloudSyncStore } from '@/lib/cloud-sync';

function friendlyDate(value: string | null) {
  if (!value) return 'Not synced yet';
  return `Last synced ${new Date(value).toLocaleString()}`;
}

export default function AccountScreen() {
  const session = useCloudSyncStore((state) => state.session);
  const pendingEmail = useCloudSyncStore((state) => state.pendingEmail);
  const syncEnabled = useCloudSyncStore((state) => state.syncEnabled);
  const syncing = useCloudSyncStore((state) => state.syncing);
  const lastSyncedAt = useCloudSyncStore((state) => state.lastSyncedAt);
  const error = useCloudSyncStore((state) => state.error);
  const signUp = useCloudSyncStore((state) => state.signUp);
  const verifySignUp = useCloudSyncStore((state) => state.verifySignUp);
  const signIn = useCloudSyncStore((state) => state.signIn);
  const signOut = useCloudSyncStore((state) => state.signOut);
  const setSyncEnabled = useCloudSyncStore((state) => state.setSyncEnabled);
  const syncNow = useCloudSyncStore((state) => state.syncNow);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) Alert.alert('Done', success);
    } catch (caught) {
      Alert.alert(
        'Could not continue',
        caught instanceof Error ? caught.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        eyebrow="Account"
        title="Secure sync"
        subtitle="Keep the app offline-first, with an optional encrypted account copy for your devices."
      >
        {session ? (
          <>
            <Card className="gap-3 p-5">
              <Typography type="h4">Signed in</Typography>
              <Typography className="text-muted text-sm">{session.user.email}</Typography>
              <Typography className="text-muted text-sm">{friendlyDate(lastSyncedAt)}</Typography>
              {error ? <Typography className="text-danger text-sm">{error}</Typography> : null}
              {syncEnabled ? (
                <>
                  <Button isDisabled={syncing || busy} onPress={() => void run(syncNow)}>
                    <Button.Label>{syncing ? 'Syncing…' : 'Sync now'}</Button.Label>
                  </Button>
                  <Button
                    variant="outline"
                    isDisabled={syncing || busy}
                    onPress={() => void run(() => setSyncEnabled(false))}
                  >
                    <Button.Label>Turn off sync</Button.Label>
                  </Button>
                </>
              ) : (
                <Button
                  isDisabled={busy}
                  onPress={() =>
                    void run(
                      () => setSyncEnabled(true),
                      'Secure sync is on. Your local records were merged with this account.',
                    )
                  }
                >
                  <Button.Label>Enable secure sync</Button.Label>
                </Button>
              )}
              <Button
                variant="outline"
                isDisabled={busy || syncing}
                onPress={() => void run(signOut)}
              >
                <Button.Label>Sign out</Button.Label>
              </Button>
            </Card>
            <PrivacyNote>
              Sync is opt-in. Records are isolated to this account. Turning sync off stops transfers
              but does not erase an existing account copy. Lab PDF files always remain device-only;
              sync transfers only their metadata and entered numeric lab values, never the PDF file.
            </PrivacyNote>
          </>
        ) : pendingEmail ? (
          <Card className="gap-4 p-5">
            <Typography type="h4">Check your email</Typography>
            <Typography className="text-muted text-sm leading-5">
              Enter the 6-digit code sent to {pendingEmail}.
            </Typography>
            <TextField isRequired>
              <Label>Verification code</Label>
              <Input
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
              />
            </TextField>
            <Button
              isDisabled={busy || code.trim().length !== 6}
              onPress={() => void run(() => verifySignUp(code))}
            >
              <Button.Label>Verify account</Button.Label>
            </Button>
          </Card>
        ) : (
          <>
            <Card className="gap-4 p-5">
              <Typography type="h4">Sign in or create an account</Typography>
              <TextField isRequired>
                <Label>Email</Label>
                <Input
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                />
              </TextField>
              <TextField isRequired>
                <Label>Password</Label>
                <Input
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                />
              </TextField>
              {error ? <Typography className="text-danger text-sm">{error}</Typography> : null}
              <Button
                isDisabled={busy || !email.trim() || password.length < 6}
                onPress={() => void run(() => signIn(email, password))}
              >
                <Button.Label>Sign in</Button.Label>
              </Button>
              <Button
                variant="outline"
                isDisabled={busy || !email.trim() || password.length < 6}
                onPress={() => void run(() => signUp(email, password))}
              >
                <Button.Label>Create account</Button.Label>
              </Button>
            </Card>
            <PrivacyNote>
              Creating an account does not upload health data. You choose whether to enable sync
              after signing in. The app continues working from local storage while offline.
            </PrivacyNote>
          </>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
