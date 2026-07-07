import { useEffect, useState } from 'react';

const MonitoringPanel = () => {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch('/api/positions');
      const data = await response.json();
      setPositions(data);
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '10px' }}>
      <h2>🚨 Monitoreo Inteligente</h2>

      {positions.map((pos, index) => (
        <div key={index}>
          <b>Device:</b> {pos.deviceId} |<b> Speed:</b> {pos.speed}
          {pos.speed > 80 && (
            <span style={{ color: 'red', marginLeft: '10px' }}>⚠️ Exceso de velocidad</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default MonitoringPanel;
