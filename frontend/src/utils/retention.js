// How long individual samples (with their window titles) are kept before the database deletes them.
// This must match the expiry rule that was switched on in the database:
//   node scripts/enable-raw-ttl.js --days 30 --apply     (see docs/ARCHITECTURE.md)
// If that number changes, change it here too: the privacy page and "Your data" quote it.
export const RAW_SAMPLE_DAYS = 30;
