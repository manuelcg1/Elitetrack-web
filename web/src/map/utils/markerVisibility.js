export const getVisibleDeviceIds = ({ markerData, isVisible }) => {
  const deviceIds = new Set();

  markerData.forEach((data, deviceId) => {
    if (data?.position && isVisible(data.position)) {
      deviceIds.add(deviceId);
    }
  });

  return deviceIds;
};
