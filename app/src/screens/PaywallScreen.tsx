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
  Linking,
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
    // No "upgrade tier" — Premium is the only tier above free today.
    subtitle: 'Subscribe for 30 sessions/mo, or wait until the 1st when the cap resets.',
  },
  manual: {
    title: 'Go Premium',
    subtitle: 'Real-time styling, full preview generation, history that remembers.',
  },
};

// Different headline when the *premium* user hit the monthly cap.
// They already paid; we can't sell them more — only inform.
const PREMIUM_MONTHLY_CAP = {
  title: "You've used this month's sessions",
  subtitle: 'Your Premium plan gives you 30 sessions per calendar month. They reset on the 1st.',
};

export default function PaywallScreen({ navigation, route }: Props) {
  const reason = route.params?.reason ?? 'manual';

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [alreadyPremium, setAlreadyPremium] = useState(false);
  const [premiumChecked, setPremiumChecked] = useState(false);
  const dialog = useDialog();

  // Different layout when the user is *already* premium and hit the
  // monthly cap. There's no upgrade to sell — render an info-only view.
  const isPremiumMonthlyCap = alreadyPremium && reason === 'monthly_cap';
  const headline = isPremiumMonthlyCap ? PREMIUM_MONTHLY_CAP : (HEADLINES[reason] ?? HEADLINES.manual);

  // Cheap entitlement check on mount. Resolves quickly because
  // configureBilling() ran during App.tsx startup. If it's still in
  // flight, awaitConfiguration inside billing.isPremium() handles it.
  // premiumChecked guards the monthly_cap render so a paying user
  // never flashes the sell-paywall before we re-render to info-only.
  useEffect(() => {
    let active = true;
    isPremium()
      .then((p) => { if (active) setAlreadyPremium(p); })
      .catch(() => {})
      .finally(() => { if (active) setPremiumChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let off: PurchasesOffering | null = null;
      try {
        await configureBilling();
        off = await getDefaultOffering();
        if (!cancelled) setOffering(off);
      } catch (e: any) {
        console.warn('[Paywall] load offerings failed:', e?.message || e);
      } finally {
        if (cancelled) return;
        setLoading(false);
        // Surface the cause to Sentry. A bare breadcrumb is only context
        // for a *later* error event — if the user closes the app after
        // seeing the failure message no event ever fires, so we'd never
        // see the breadcrumb. captureMessage on the failure path actually
        // shows up in the issue list. Success path still breadcrumbs so
        // subsequent errors (e.g. a later session WS failure) have context.
        const f = getBillingFailure();
        if (f.reason) {
          Sentry.captureMessage('Paywall offer failed to load', {
            level: 'warning',
            tags: { reason: f.reason },
            extra: {
              detail: f.message,
              configured: isBillingConfigured(),
              has_offering: !!off,
            },
          });
        } else {
          Sentry.addBreadcrumb({
            category: 'billing',
            message: 'Paywall loaded ok',
            level: 'info',
            data: { has_offering: !!off },
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

  // Info-only variant: premium user who hit the monthly cap. They
  // already paid; there's nothing left to sell. Skip the bullets,
  // packages, restore CTA, and fineprint — just inform and dismiss.
  if (isPremiumMonthlyCap) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{headline.title}</Text>
          <Text style={styles.subtitle}>{headline.subtitle}</Text>
        </View>
        <View style={styles.dismiss}>
          <BubbleButton onPress={() => navigation.goBack()}>
            Got it
          </BubbleButton>
        </View>
      </ScrollView>
    );
  }

  // Flash-of-wrong-content guard for the capped-premium user. If we
  // landed here because of monthly_cap and haven't yet learned whether
  // this user is premium, hold a spinner rather than flashing the
  // sell-paywall to someone who's already subscribed. Other reasons
  // (trial_used / manual) are unaffected since the sell view is the
  // correct render for them regardless of premium state.
  if (reason === 'monthly_cap' && !premiumChecked) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ActivityIndicator color={COLORS.pink} style={{ marginTop: 64 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{headline.title}</Text>
        <Text style={styles.subtitle}>{headline.subtitle}</Text>
      </View>

      <View style={styles.benefits}>
        <Bullet text="Real-time AI stylist conversations" />
        <Bullet text="Up to 30 sessions per month" />
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

      {/* Tappable Terms + Privacy links are required by Apple Guideline
          3.1.2 for auto-renewable subscriptions — plaintext URLs in a
          <Text> have triggered rejections. Community Guidelines doesn't
          strictly need to be tappable but matches the pattern. */}
      <Text style={styles.fineprint}>
        Subscriptions auto-renew until cancelled. Manage in your device's
        subscription settings.{' '}
        <Text
          style={styles.fineprintLink}
          onPress={() => Linking.openURL('https://livestylist.app/terms.html').catch(() => {})}>
          Terms
        </Text>
        {' — '}
        <Text
          style={styles.fineprintLink}
          onPress={() => Linking.openURL('https://livestylist.app/privacy.html').catch(() => {})}>
          Privacy
        </Text>
        {' — '}
        <Text
          style={styles.fineprintLink}
          onPress={() => Linking.openURL('https://livestylist.app/community-guidelines.html').catch(() => {})}>
          Community Guidelines
        </Text>
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
  fineprintLink: { color: COLORS.pink, textDecorationLine: 'underline', opacity: 1 },
});
