window.config = {
  routerBasename: '/viewer',
  servers: {
    dicomWeb: [
      {
        name: 'Orthanc',
        wadoUriRoot: '/orthanc-proxy/wado',
        qidoRoot: '/orthanc-proxy/dicom-web',
        wadoRoot: '/orthanc-proxy/dicom-web',
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
      },
    ],
  },
};
