import React, { useState } from 'react';
import { Layout, Menu, Typography, Button, Avatar, Space, Tag } from 'antd';
import {
  DashboardOutlined, UserOutlined, FileTextOutlined,
  WarningOutlined, LogoutOutlined, HeartFilled, CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

const { Sider, Header, Content } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS = [
  { key: '/',         icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/users',    icon: <UserOutlined />,      label: 'Users' },
  { key: '/requests', icon: <FileTextOutlined />,  label: 'Blood Requests' },
  { key: '/camps',    icon: <CalendarOutlined />,  label: 'Camps & Events' },
  { key: '/reports',  icon: <WarningOutlined />,   label: 'Reports' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: '#1a1a2e' }}
      >
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <HeartFilled style={{ color: '#c0392b', fontSize: collapsed ? 28 : 36 }} />
          {!collapsed && (
            <div style={{ marginTop: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 700, display: 'block' }}>
                Blood Donation
              </Text>
              <Text style={{ color: '#aaa', fontSize: 11 }}>Admin Portal</Text>
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ background: 'transparent', borderRight: 0 }}
          items={NAV_ITEMS.map(item => ({ ...item, onClick: () => navigate(item.key) }))}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <Title level={5} style={{ margin: 0 }}>
            {NAV_ITEMS.find(n => n.key === location.pathname)?.label ?? 'Admin'}
          </Title>
          <Space>
            {user && (
              <>
                <Avatar style={{ background: '#c0392b' }}>
                  {user.name?.charAt(0)?.toUpperCase() ?? 'A'}
                </Avatar>
                <Text strong>{user.name}</Text>
                <Tag color="red">{user.role}</Tag>
              </>
            )}
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              type="text"
              danger
            >
              {collapsed ? '' : 'Logout'}
            </Button>
          </Space>
        </Header>

        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
