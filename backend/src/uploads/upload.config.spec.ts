import { assertProductionStorageConfiguration } from './upload.config';

describe('upload configuration', () => {
  it('allows local storage outside production', () => {
    expect(() =>
      assertProductionStorageConfiguration({
        NODE_ENV: 'development',
        STORAGE_DRIVER: 'local',
      }),
    ).not.toThrow();
  });

  it('allows S3 storage in production', () => {
    expect(() =>
      assertProductionStorageConfiguration({
        NODE_ENV: 'production',
        STORAGE_DRIVER: 's3',
      }),
    ).not.toThrow();
  });

  it.each([undefined, '', 'local'])(
    'rejects production storage driver %s',
    (storageDriver) => {
      expect(() =>
        assertProductionStorageConfiguration({
          NODE_ENV: 'production',
          STORAGE_DRIVER: storageDriver,
        }),
      ).toThrow('Production requires STORAGE_DRIVER=s3');
    },
  );
});
