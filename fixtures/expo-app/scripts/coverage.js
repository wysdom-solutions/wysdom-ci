// Fixture coverage stub: writes a minimal coverage report so the workflow's
// upload-artifact step has something to publish. Extra CLI args passed by the
// workflow (--ci, --maxWorkers) are accepted and ignored.
const fs = require('fs');
fs.mkdirSync('coverage', { recursive: true });
fs.writeFileSync('coverage/lcov.info', 'TN:\nend_of_record\n');
console.log('test:coverage: wrote coverage/lcov.info');
