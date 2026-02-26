import { Share } from 'react-native';

export async function shareSummary(summary: string, tips?: string[]): Promise<void> {
  let message = `${summary}`;

  if (tips && tips.length > 0) {
    message += '\n\nStyle Tips:';
    tips.forEach((tip, i) => {
      message += `\n${i + 1}. ${tip}`;
    });
  }

  message += '\n\nPowered by LiveStylist AI';

  try {
    await Share.share({ message });
  } catch {
    // User cancelled or share failed — silently ignore
  }
}
