import React from 'react';
import { Card, Col, Row, Statistic, Typography, Spin, Alert } from 'antd';
import {
  TeamOutlined, HeartOutlined, FileSearchOutlined,
  CheckCircleOutlined, WarningOutlined, HeartFilled,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin.api';

const { Title, Text } = Typography;

const StatCard = ({
  title, value, icon, color,
}: {
  title: string;
  value: number | undefined;
  icon: React.ReactNode;
  color: string;
}) => (
  <Card style={{ borderTop: `3px solid ${color}` }}>
    <Statistic
      title={<Text style={{ fontSize: 13 }}>{title}</Text>}
      value={value ?? 0}
      prefix={<span style={{ color, marginRight: 4 }}>{icon}</span>}
      valueStyle={{ color: '#1a1a1a', fontWeight: 700 }}
    />
  </Card>
);

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Alert type="error" message="Failed to load dashboard stats" />;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>Overview</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Total Users"
            value={stats?.totalUsers}
            icon={<TeamOutlined />}
            color="#1565c0"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Registered Donors"
            value={stats?.totalDonors}
            icon={<HeartFilled />}
            color="#c0392b"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Active Requests"
            value={stats?.activeRequests}
            icon={<FileSearchOutlined />}
            color="#e67e22"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Pending Verifications"
            value={stats?.pendingVerifications}
            icon={<CheckCircleOutlined />}
            color="#8e44ad"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Open Reports"
            value={stats?.openReports}
            icon={<WarningOutlined />}
            color="#e74c3c"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            title="Total Donations"
            value={stats?.totalDonations}
            icon={<HeartOutlined />}
            color="#27ae60"
          />
        </Col>
      </Row>
    </div>
  );
}
