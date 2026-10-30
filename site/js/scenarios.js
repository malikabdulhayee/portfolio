/*
 * Audit Me: all game content lives here.
 * Edit wording, hints and unlock text without touching game code.
 * Loaded as a classic script (not fetch) so the site also works when index.html
 * is opened straight from disk.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.AUDIT_SCENARIOS = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    caseFileTitle: 'Case file',
    scenarios: [
      {
        id: 's1',
        bonus: false,
        severity: 'Critical',
        resource: {
          kind: 'S3 bucket',
          name: 'portfolio-assets-prod',
          rows: [
            { k: 'Block public access', v: 'Off', bad: true },
            { k: 'Bucket policy', v: 'Principal * can GetObject', bad: true },
            { k: 'Default encryption', v: 'None', bad: true },
            { k: 'Versioning', v: 'Enabled' },
            { k: 'Region', v: 'ap-south-1' }
          ]
        },
        prompt: 'This bucket stores build artifacts, and anyone with the URL can read them. Which fix closes the exposure?',
        options: [
          { text: 'Turn on Block Public Access and default encryption', correct: true },
          { text: 'Rename the bucket to a long random name', hint: 'Obscurity is not access control. Anyone who learns the new URL can still read everything.' },
          { text: 'Add the tag visibility=private', hint: 'Tags describe a bucket. They do not enforce anything.' },
          { text: 'Add a lifecycle rule that deletes old objects', hint: 'Lifecycle rules manage storage cost. They do not change who can read the objects.' }
        ],
        why: 'Block Public Access overrides any public policy or ACL, and default encryption protects the data at rest. Together they remove the exposure instead of hiding it.',
        fixLabel: 'Block Public Access and default encryption',
        unlock: {
          title: 'Secure DevSecOps pipeline',
          body: 'I built a CI/CD pipeline that runs SAST, DAST and compliance checks at every stage. It deploys to EC2 with least-privilege IAM roles, encrypted S3 storage, hardened security groups and CloudWatch and CloudTrail monitoring.',
          target: '#project-pipeline',
          targetLabel: 'Read the project'
        },
        casefile: {
          label: 'Security project',
          value: 'A DevSecOps pipeline with scanning at every stage, least-privilege IAM and encrypted storage.'
        }
      },
      {
        id: 's2',
        bonus: false,
        severity: 'High',
        resource: {
          kind: 'IAM role',
          name: 'orders-api-role',
          rows: [
            { k: 'Attached policy', v: 'AdministratorAccess (Action *, Resource *)', bad: true },
            { k: 'Used in the last 90 days', v: 's3:GetObject, dynamodb:PutItem' },
            { k: 'Trusted by', v: 'lambda.amazonaws.com' },
            { k: 'Permission boundary', v: 'None', bad: true }
          ]
        },
        prompt: 'A small API function runs with full administrator rights, but it only ever reads from S3 and writes to DynamoDB. What is the right fix?',
        options: [
          { text: 'Replace it with a policy that allows only s3:GetObject and dynamodb:PutItem on this API’s own resources', correct: true },
          { text: 'Keep AdministratorAccess and add a deny for iam:DeleteUser', hint: 'A deny list blocks one action and leaves everything else allowed.' },
          { text: 'Rotate the role’s access keys every week', hint: 'Roles use temporary credentials already. Rotation does not shrink what they are allowed to do.' },
          { text: 'Rename the role to orders-api-readonly', hint: 'A name is not a permission. The role could still do everything.' }
        ],
        why: 'Least privilege means granting exactly what the workload uses, and the usage report shows what that is. If this function is ever compromised, the damage stays inside two actions.',
        fixLabel: 'Least-privilege policy',
        unlock: {
          title: 'Snack Out: the numbers',
          body: 'As assistant DevOps engineer I put SAST and DAST into the pipeline and caught 95% of vulnerabilities before deployment. Releases went out 40% more often and cloud costs fell 25%, with 99.9% uptime for 10,000+ users.',
          target: '#experience',
          targetLabel: 'See my experience'
        },
        casefile: {
          label: 'Measured result',
          value: '95% of vulnerabilities caught before deployment, with cloud costs down 25%.'
        }
      },
      {
        id: 's3',
        bonus: false,
        severity: 'High',
        resource: {
          kind: 'Security group',
          name: 'web-sg (attached to an EC2 instance)',
          rows: [
            { k: 'Inbound SSH (22)', v: 'From 0.0.0.0/0', bad: true },
            { k: 'Inbound HTTPS (443)', v: 'From 0.0.0.0/0' },
            { k: 'SSM agent', v: 'Installed, instance profile attached' },
            { k: 'Key pair', v: 'Shared by the whole team', bad: true }
          ]
        },
        prompt: 'SSH is open to the entire internet. Which fix removes the risk instead of reducing it?',
        options: [
          { text: 'Delete the open SSH rule and connect through Session Manager', correct: true },
          { text: 'Move SSH to port 2222', hint: 'Scanners probe every port. A different number does not shrink the exposure.' },
          { text: 'Keep port 22 open but turn off password login', hint: 'Key-only login helps, but the port is still reachable from everywhere. Remove the exposure first.' },
          { text: 'Add an alarm for failed SSH logins', hint: 'An alarm tells you about an attack after it starts. It does not prevent one.' }
        ],
        why: 'The SSM agent is already installed, so Session Manager gives shell access with no inbound port at all, and every session is logged. No open port means nothing to scan.',
        fixLabel: 'Close port 22, use Session Manager',
        unlock: {
          title: 'Kubernetes microservices',
          body: 'I deployed containerised services on Kubernetes with Helm charts, Ingress and autoscaling. Prometheus alerting rules and Grafana dashboards track SLIs and SLOs in real time.',
          target: '#project-k8s',
          targetLabel: 'Read the project'
        },
        casefile: {
          label: 'Platform project',
          value: 'Kubernetes microservices with autoscaling, Prometheus alerting and Grafana dashboards.'
        }
      },
      {
        id: 's4',
        bonus: true,
        severity: 'Medium',
        resource: {
          kind: 'CloudTrail',
          name: 'account audit logging',
          rows: [
            { k: 'Trails', v: '0', bad: true },
            { k: 'Last log delivery', v: 'Never', bad: true },
            { k: 'Event history', v: '90 days, console only' },
            { k: 'Regions in use', v: 'ap-south-1, us-east-1' }
          ]
        },
        prompt: 'Nobody can say who changed what in this account. How do you fix the gap?',
        options: [
          { text: 'Create a multi-region trail with log file validation, delivered to a locked-down bucket', correct: true },
          { text: 'Rely on CloudWatch metrics instead', hint: 'Metrics show how much happened, not who did what. You cannot investigate an incident with them.' },
          { text: 'Create a trail in one region only', hint: 'Attackers use the regions you are not watching. A trail has to cover all of them.' },
          { text: 'Turn logging on, then delete logs older than a day to save cost', hint: 'Logs are evidence. Deleting them removes what an investigation needs.' }
        ],
        why: 'A multi-region trail records API activity everywhere, log file validation shows whether anyone altered the logs, and a locked-down bucket keeps them out of reach.',
        fixLabel: 'Multi-region trail with log validation',
        unlock: {
          title: 'Superpower unlocked',
          body: 'I make security a step the pipeline runs, not a review that happens afterwards. Fun fact: my first cloud certification took one week of preparation, and the wall now includes AWS, Azure and Google Cloud.',
          target: '#about',
          targetLabel: 'Back to my case file'
        },
        casefile: {
          label: 'Superpower',
          value: 'Making security a step the pipeline runs, not a review that happens afterwards.'
        }
      }
    ]
  };
});
