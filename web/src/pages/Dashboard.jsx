import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Empty, Spin } from 'antd';
import {
  ThunderboltOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  StarOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { api } from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [info, setInfo] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getLogStats(), api.getInfo(), api.getApps()])
      .then(([s, i, a]) => { setStats(s); setInfo(i); setApps(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>Dashboard</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Requests Today" value={stats?.today || 0} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Total Requests" value={stats?.total || 0} prefix={<ApiOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Avg Latency" value={stats?.avgLatency || 0} suffix="ms" prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Default Provider" value={info?.default_provider || '-'} prefix={<StarOutlined />} />
          </Card>
        </Col>
      </Row>

      <h3 style={{ marginBottom: 16 }}>Apps</h3>
      {apps.length === 0 ? (
        <Empty description="No apps configured" />
      ) : (
        <Row gutter={[16, 16]}>
          {apps.map((app) => (
            <Col xs={12} sm={8} md={6} key={app.id}>
              <Card
                hoverable
                style={{ textAlign: 'center' }}
                onClick={() => window.open(app.url, '_blank')}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>{app.icon || <LinkOutlined />}</div>
                <Card.Meta title={app.name} description={app.description || app.url} />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
