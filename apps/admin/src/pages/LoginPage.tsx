import React, { useState } from 'react';
import { Button, Card, Form, Input, message, Space, Typography } from 'antd';
import { HeartFilled, MobileOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/admin.api';
import { useAuthStore } from '../store/auth.store';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);

  const handleSendOtp = async (values: { phone: string }) => {
    setLoading(true);
    try {
      await authApi.sendOtp(values.phone);
      setPhone(values.phone);
      setStep('otp');
      message.success('OTP sent successfully');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e?.response?.data?.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (values: { otp: string }) => {
    setLoading(true);
    try {
      const result = await authApi.verifyOtp(phone, values.otp);
      if (result.isNewUser || !result.accessToken || !result.user) {
        message.error('No admin account found for this number');
        return;
      }
      if (!['ADMIN', 'SUPER_ADMIN'].includes(result.user.role)) {
        message.error('Access denied: admin role required');
        return;
      }
      login(result.user, result.accessToken, result.refreshToken!);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e?.response?.data?.message ?? 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f5f5f5',
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <HeartFilled style={{ color: '#c0392b', fontSize: 48, marginBottom: 8 }} />
            <Title level={3} style={{ margin: 0 }}>Admin Portal</Title>
            <Text type="secondary">Blood Donation Management</Text>
          </div>

          {step === 'phone' ? (
            <Form layout="vertical" onFinish={handleSendOtp}>
              <Form.Item
                name="phone"
                label="Phone Number"
                rules={[{ required: true, message: 'Enter your phone number' }]}
              >
                <Input
                  prefix={<MobileOutlined />}
                  placeholder="+91 9876543210"
                  size="large"
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" size="large" block loading={loading}
                  style={{ background: '#c0392b', borderColor: '#c0392b' }}>
                  Send OTP
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <Form layout="vertical" onFinish={handleVerifyOtp}>
              <Text style={{ display: 'block', marginBottom: 16 }}>
                OTP sent to <strong>{phone}</strong>
              </Text>
              <Form.Item
                name="otp"
                label="Enter OTP"
                rules={[{ required: true, len: 6, message: 'Enter the 6-digit OTP' }]}
              >
                <Input
                  prefix={<SafetyOutlined />}
                  placeholder="123456"
                  size="large"
                  maxLength={6}
                />
              </Form.Item>
              <Space style={{ width: '100%' }}>
                <Button onClick={() => setStep('phone')} size="large" style={{ flex: 1 }}>
                  Back
                </Button>
                <Button type="primary" htmlType="submit" size="large" loading={loading}
                  style={{ flex: 2, background: '#c0392b', borderColor: '#c0392b' }}>
                  Verify & Login
                </Button>
              </Space>
            </Form>
          )}
        </Space>
      </Card>
    </div>
  );
}
