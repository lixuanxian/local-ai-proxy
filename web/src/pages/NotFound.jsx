import { Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="not-found animate-fade-in">
      <div className="not-found-code">404</div>
      <div className="not-found-text">
        This page doesn't exist or has been moved.
      </div>
      <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
        Back to Dashboard
      </Button>
    </div>
  );
}
