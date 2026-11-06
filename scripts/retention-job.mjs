/** Intentional report-only job. Requires policy review before any destructive implementation is enabled. */
import { policyMetadata, retentionPlan, canExecuteRetention } from './retention-policy.mjs';
const requestedExecute=process.argv.includes('--execute');
const approvalErrors=canExecuteRetention(policyMetadata,process.env);
const report={version:policyMetadata.version, policyStatus:policyMetadata.status, mode:'DRY_RUN', executionRequested:requestedExecute, deletionPerformed:false, categories:retentionPlan(), blockers:approvalErrors, externalSystemsRequireIndependentReview:true};
// Never silently switch from planning into a destructive operation; even after
// legal approval, an independently reviewed executor with hold-aware queries,
// journaling, backups and bounded batching must be separately deployed.
if(requestedExecute){report.blockers.push('DESTRUCTIVE_EXECUTOR_NOT_ENABLED');console.log(JSON.stringify(report,null,2));process.exitCode=2;}
else console.log(JSON.stringify(report,null,2));
