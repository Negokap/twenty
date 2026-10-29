import { createHash } from 'crypto';

import { TEST_APPLICATION_PACKAGE_JSON_CHECKSUM } from 'test/integration/metadata/suites/application/constants/test-application-package-json.constant';
import { buildBaseManifest } from 'test/integration/metadata/suites/application/utils/build-base-manifest.util';
import { cleanupApplicationAndAppRegistration } from 'test/integration/metadata/suites/application/utils/cleanup-application-and-app-registration.util';
import { findOneApplication } from 'test/integration/metadata/suites/application/utils/find-one-application.util';
import { setupApplicationForSync } from 'test/integration/metadata/suites/application/utils/setup-application-for-sync.util';
import { syncApplication } from 'test/integration/metadata/suites/application/utils/sync-application.util';
import { uploadApplicationFile } from 'test/integration/metadata/suites/application/utils/upload-application-file.util';
import { type Manifest } from 'twenty-shared/application';
import { v4 as uuidv4 } from 'uuid';

const APPLICATION_UNIVERSAL_IDENTIFIER = uuidv4();
const ROLE_UNIVERSAL_IDENTIFIER = uuidv4();
const APPLICATION_NAME = 'Application syncing a user health check';

const HEALTH_CHECK_SOURCE = `export const handler = () => ({ status: 'OK' });`;

const WORKSPACE_HEALTH_CHECK = {
  universalIdentifier: uuidv4(),
  name: 'workspace-health-check',
};

const USER_HEALTH_CHECK = {
  universalIdentifier: uuidv4(),
  name: 'user-health-check',
};

const HEALTH_CHECKS = [WORKSPACE_HEALTH_CHECK, USER_HEALTH_CHECK];

const buildHealthCheckManifest = ({
  shouldIncludeUserHealthCheck,
}: {
  shouldIncludeUserHealthCheck: boolean;
}): Manifest =>
  buildBaseManifest({
    appId: APPLICATION_UNIVERSAL_IDENTIFIER,
    roleId: ROLE_UNIVERSAL_IDENTIFIER,
    overrides: {
      application: {
        universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
        defaultRoleUniversalIdentifier: ROLE_UNIVERSAL_IDENTIFIER,
        displayName: APPLICATION_NAME,
        description: 'App for testing the user health check sync',
        applicationVariables: {},
        healthCheckLogicFunction: {
          universalIdentifier: WORKSPACE_HEALTH_CHECK.universalIdentifier,
        },
        ...(shouldIncludeUserHealthCheck
          ? {
              userHealthCheckLogicFunction: {
                universalIdentifier: USER_HEALTH_CHECK.universalIdentifier,
              },
            }
          : {}),
        packageJsonChecksum: TEST_APPLICATION_PACKAGE_JSON_CHECKSUM,
        yarnLockChecksum: null,
      },
      logicFunctions: HEALTH_CHECKS.map(({ universalIdentifier, name }) => ({
        universalIdentifier,
        name,
        handlerName: 'handler',
        sourceHandlerPath: `src/${name}.ts`,
        builtHandlerPath: `dist/${name}.mjs`,
        builtHandlerChecksum: createHash('sha256')
          .update(HEALTH_CHECK_SOURCE)
          .digest('hex'),
        timeoutSeconds: 10,
      })),
    },
  });

const findStoredHealthCheckUniversalIdentifiers = async (
  applicationId: string,
): Promise<{
  healthCheckUniversalIdentifier: string | null;
  userHealthCheckUniversalIdentifier: string | null;
}> => {
  const [storedApplication] = await globalThis.testDataSource.query(
    `SELECT
       "healthCheckLogicFunction"."universalIdentifier" AS "healthCheckUniversalIdentifier",
       "userHealthCheckLogicFunction"."universalIdentifier" AS "userHealthCheckUniversalIdentifier"
     FROM core."application" "application"
     LEFT JOIN core."logicFunction" "healthCheckLogicFunction"
       ON "healthCheckLogicFunction".id = "application"."healthCheckLogicFunctionId"
     LEFT JOIN core."logicFunction" "userHealthCheckLogicFunction"
       ON "userHealthCheckLogicFunction".id = "application"."userHealthCheckLogicFunctionId"
     WHERE "application".id = $1`,
    [applicationId],
  );

  return storedApplication;
};

describe('Sync application user health check should succeed', () => {
  let applicationId: string;

  beforeAll(async () => {
    await setupApplicationForSync({
      applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
      name: APPLICATION_NAME,
      description: 'App for testing the user health check sync',
      sourcePath: `test-${APPLICATION_UNIVERSAL_IDENTIFIER}`,
    });
    jest.useRealTimers();

    for (const { name } of HEALTH_CHECKS) {
      await uploadApplicationFile({
        applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
        fileFolder: 'BuiltLogicFunction',
        filePath: `dist/${name}.mjs`,
        filename: `${name}.mjs`,
        contentType: 'application/javascript',
        fileBuffer: Buffer.from(HEALTH_CHECK_SOURCE),
        expectToFail: false,
      });
    }

    await syncApplication({
      manifest: buildHealthCheckManifest({
        shouldIncludeUserHealthCheck: true,
      }),
      expectToFail: false,
    });
    jest.useRealTimers();

    const { data } = await findOneApplication({
      input: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
      gqlFields: 'id',
      expectToFail: false,
    });

    applicationId = data.findOneApplication.id;
  }, 120000);

  afterAll(async () => {
    await cleanupApplicationAndAppRegistration({
      applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    });
  });

  it('should store the USER health check next to the WORKSPACE one', async () => {
    expect(
      await findStoredHealthCheckUniversalIdentifiers(applicationId),
    ).toEqual({
      healthCheckUniversalIdentifier:
        WORKSPACE_HEALTH_CHECK.universalIdentifier,
      userHealthCheckUniversalIdentifier: USER_HEALTH_CHECK.universalIdentifier,
    });
  });

  it('should clear only the USER health check when a full sync no longer declares it', async () => {
    await syncApplication({
      manifest: buildHealthCheckManifest({
        shouldIncludeUserHealthCheck: false,
      }),
      expectToFail: false,
    });
    jest.useRealTimers();

    expect(
      await findStoredHealthCheckUniversalIdentifiers(applicationId),
    ).toEqual({
      healthCheckUniversalIdentifier:
        WORKSPACE_HEALTH_CHECK.universalIdentifier,
      userHealthCheckUniversalIdentifier: null,
    });
  });
});
