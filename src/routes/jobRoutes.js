const express = require('express');
const { createNewJob, runJobDirectly, getAllJobs } = require('../controllers/jobController');

const router = express.Router();
//كل واحد بيروح لـ Controller.
router.post('/create-job', createNewJob);
router.post('/run-job', runJobDirectly);
router.get('/jobs', getAllJobs);

module.exports = router;
