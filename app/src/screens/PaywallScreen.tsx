import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  ToastAndroid,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import { useDialog } from '../components/AppDialog';
import * as Sentry from '@sentry/react-native';
import {
  configureBilling,
  getDefaultOffering,
  getBillingFailure,
  isBillingConfigured,
  purchase,
  restore,
  isPremium,
} from '../services/billing';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Paywall'>;

const HEADLINES: Record<string, { title: string; subtitle: string }> = {
  trial_used: {
    title: 'Your free session is used up',
    subtitle: 'Subscribe to keep getting real-time style advice from your AI stylist.',
  },
  monthly_cap: {
    title: "You've hit this month's limit",
    subtitle: 'Your monthly cap resets on the 1st. Upgrade tier or wait it out.',
  },
  manual: {
    title: 'Go Premium',
    subtitle: 'Unlimited styling sessions, full preview generation, history that remembers.',
  },
};

export default function PaywallScreen({ navigation, route }: Props) {
  const reason = route.params?.reason ?? 'manual';
  const headline = HEADLINES[reason] ?? HEADLINES.manual;

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const dialog = useDialog();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await configureBilling();
        const off = await getDefaultOffering();
        if (!cancelled) setOffering(off);
      } catch (e: any) {
        console.warn('[Paywall] load offerings failed:', e?.message || e);
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Sentry breadcrumb on every Paywall open. Useful in TestFlight
          // where console output is invisible — surfaces *why* the offer
          // didn't load (no_key / configure_failed / no_offering / null=ok).
          const f = getBillingFailure();
          Sentry.addBreadcrumb({
            category: 'billing',
            message: 'Paywall loaded',
            level: f.reason ? 'warning' : 'info',
            data: {
              reason: f.reason,
              detail: f.message,
              configured: isBillingConfigured(),
              has_offering: !!offering,
            },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      await purchase(pkg);
      const ok = await isPremium();
      if (ok) {
        showToast('Welcome to Premium!');
        navigation.goBack();
      } else {
        showToast('Purchase did not complete');
      }
    } catch (e: any) {
      // RevenueCat throws { userCancelled: true } when the user dismisses
      if (e?.userCancelled) return;
      await dialog.alert({ title: 'Purchase failed', message: e?.message || 'Please try again.' });
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      await restore();
      const ok = await isPremium();
      if (ok) {
        showToast('Premium restored!');
        navigation.goBack();
      } else {
        await dialog.alert({ title: 'No purchases found', message: 'No active subscription on this account.' });
      }
    } catch (e: any) {
      await dialog.alert({ title: 'Restore failed', message: e?.message || 'Please try again.' });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{headline.title}</Text>
        <Text style={styles.subtitle}>{headline.subtitle}</Text>
      </View>

      <View style={styles.benefits}>
        <Bullet text="Real-time AI stylist conversations" />
        <Bullet text="Unlimited daily sessions (30/mo soft cap)" />
        <Bullet text="Full image preview generation" />
        <Bullet text="Personal style memory across sessions" />
        <Bullet text="EU-resident data, no tracking" />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.pink} style={{ marginVertical: 32 }} />
      ) : !isBillingConfigured() || !offering ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {(() => {
              const f = getBillingFailure();
              switch (f.reason) {
                case 'no_key':
                  return 'In-app purchases not available in this build. Check back after launch.';
                case 'configure_failed':
                  return `Could not connect to the App Store. Try again in a minute, or use Restore Purchases if you've subscribed.\n\n(${f.message})`;
                case 'no_offering':
                  return 'Subscriptions are being set up. If you’ve subscribed already, tap Restore Purchases.';
                default:
                  return 'In-app purchases not yet available. Check back after launch.';
              }
            })()}
          </Text>
        </View>
      ) : (
        <View style={styles.packages}>
          {offering.availablePackages.map((pkg) => (
            <PackageRow key={pkg.identifier} pkg={pkg} onPress={handlePurchase} />
          ))}
        </View>
      )}

      <TouchableOpacity onPress={handleRestore} disabled={purchasing}>
        <Text style={styles.restore}>Restore purchases</Text>
      </TouchableOpacity>

      <View style={styles.dismiss}>
        <BubbleButton variant="ghost" onPress={() => navigation.goBack()}>
          Maybe later
        </BubbleButton>
      </View>

      <Text style={styles.fineprint}>
        Subscriptions auto-renew until cancelled. Manage in your device's
        subscription settings. Terms: https://livestylist.app/terms — Privacy:
        https://livestylist.app/privacy
      </Text>
    </ScrollView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function PackageRow({
  pkg,
  onPress,
}: {
  pkg: PurchasesPackage;
  onPress: (pkg: PurchasesPackage) => void;
}) {
  const product = pkg.product;
  const isAnnual = pkg.packageType === 'ANNUAL';
  return (
    <TouchableOpacity style={styles.pkg} onPress={() => onPress(pkg)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.pkgTitle}>{isAnnual ? 'Annual' : 'Monthly'}</Text>
        <Text style={styles.pkgDesc}>{product.description}</Text>
      </View>
      <View>
        <Text style={styles.pkgPrice}>{product.priceString}</Text>
        {isAnnual && <Text style={styles.pkgSavings}>Save ~33%</Text>}
      </View>
    </TouchableOpacity>
  );
}

function showToast(msg: string) {
  // Quick non-blocking confirmation. iOS gets the in-app dialog via the
  // useDialog hook in the caller; here we use the native Toast on Android only.
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 24, paddingBottom: 64 },
  header: { marginTop: 32, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.charcoal, marginBottom: 8 },
  subtitle: { fontSize: 16, color: COLORS.charcoal, opacity: 0.7, lineHeight: 22 },
  benefits: { marginBottom: 32 },
  bullet: { flexDirection: 'row', marginBottom: 10 },
  bulletDot: { color: COLORS.pink, fontSize: 18, marginRight: 10, fontWeight: '900' },
  bulletText: { flex: 1, color: COLORS.charcoal, fontSize: 15, lineHeight: 22 },
  packages: { gap: 12, marginBottom: 24 },
  pkg: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.pink + '30',
  },
  pkgTitle: { fontSize: 18, fontWeight: '700', color: COLORS.charcoal },
  pkgDesc: { fontSize: 13, color: COLORS.charcoal, opacity: 0.6, marginTop: 2 },
  pkgPrice: { fontSize: 18, fontWeight: '800', color: COLORS.pink, textAlign: 'right' },
  pkgSavings: { fontSize: 11, color: COLORS.charcoal, opacity: 0.6, textAlign: 'right' },
  placeholder: { padding: 16, marginBottom: 24, backgroundColor: '#0001', borderRadius: 12 },
  placeholderText: { color: COLORS.charcoal, opacity: 0.6, textAlign: 'center' },
  restore: { color: COLORS.charcoal, opacity: 0.6, textAlign: 'center', marginBottom: 16, textDecorationLine: 'underline' },
  dismiss: { marginBottom: 24 },
  fineprint: { fontSize: 11, color: COLORS.charcoal, opacity: 0.5, textAlign: 'center', lineHeight: 16 },
});
