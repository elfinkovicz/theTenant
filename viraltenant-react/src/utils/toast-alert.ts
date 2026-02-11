/**
 * Toast Alert Utility
 * 
 * Replaces native browser alert() with toast notifications
 * Import this file early in your app to override alert globally
 */

import { toast } from '../hooks/useToast';

// Store original alert function
const originalAlert = window.alert;

// Override window.alert with toast notifications
window.alert = function(message: string) {
  // Detect message type based on content
  const msg = String(message);
  
  // Success indicators
  if (msg.includes('✅') || msg.includes('erfolgreich') || msg.includes('gesendet') || msg.includes('gespeichert')) {
    // Remove emoji if present
    const cleanMsg = msg.replace(/✅\s*/g, '');
    toast.success(cleanMsg);
    return;
  }
  
  // Error indicators
  if (msg.includes('❌') || msg.includes('Fehler') || msg.includes('fehlgeschlagen') || msg.includes('Error')) {
    // Remove emoji if present
    const cleanMsg = msg.replace(/❌\s*/g, '');
    toast.error(cleanMsg);
    return;
  }
  
  // Warning indicators
  if (msg.includes('⚠️') || msg.includes('Warnung') || msg.includes('ausverkauft') || msg.includes('nicht')) {
    const cleanMsg = msg.replace(/⚠️\s*/g, '');
    toast.warning(cleanMsg);
    return;
  }
  
  // Default to info
  toast.info(msg);
};

// Restore original alert (for debugging if needed)
export function restoreOriginalAlert() {
  window.alert = originalAlert;
}

// Export for manual usage
export { toast };
