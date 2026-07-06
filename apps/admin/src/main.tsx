import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, App } from 'antd';
import { router } from './router';
import 'antd/dist/reset.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#c0392b',
            colorLink: '#c0392b',
            borderRadius: 8,
          },
        }}
      >
        <App>
          <RouterProvider router={router} />
        </App>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
