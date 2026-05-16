const eventProfiles = {
  FILE_UPLOADED: {
    category: 'storage.file',
    description: 'Triggered when a file upload completes successfully.'
  },
  BACKUP_COMPLETED: {
    category: 'storage.backup',
    description: 'Triggered when a backup job completes successfully.'
  }
};

module.exports = {
  eventProfiles,
  supportedEventTypes: Object.keys(eventProfiles)
};
