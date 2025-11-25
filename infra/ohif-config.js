window.config = {
  routerBasename: '/viewer',
  servers: {
    dicomWeb: [
      {
        name: 'Orthanc',
        wadoUriRoot: 'http://orthanc:8042/wado',
        qidoRoot: 'http://orthanc:8042/dicom-web',
        wadoRoot: 'http://orthanc:8042/dicom-web',
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
      },
    ],
  },
};
