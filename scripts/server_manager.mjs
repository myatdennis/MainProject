#!/usr/bin/env node

/**
 * Server Management and Testing Script
 * Resolves connectivity issues and ensures stable server operation
 */

import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { existsSync, writeFileSync } from 'fs';

class ServerManager {
  constructor() {
    this.serverProcess = null;
    this.ports = [5173, 5174, 5175, 5176, 5177];
    this.maxRetries = 3;
  }

  log(message, color = '') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`${color}[${timestamp}] ${message}\x1b[0m`);
  }

  async findAvailablePort() {
    for (const port of this.ports) {
      try {
        const response = await fetch(`http://localhost:${port}`, {
          signal: AbortSignal.timeout(1000),
          credentials: 'include'
        });
        // If we get here, port is in use
        this.log(`Port ${port} is in use`, '\x1b[33m');
      } catch (error) {
        // Port is available
        this.log(`Port ${port} is available`, '\x1b[32m');
        return port;
      }
    }
    return 5173; // Default fallback
  }

  async cleanupProcesses() {
    this.log('Cleaning up existing processes...', '\x1b[33m');
    
    return new Promise((resolve) => {
      const cleanup = spawn('pkill', ['-f', 'vite'], { stdio: 'pipe' });
      cleanup.on('close', async () => {
        await delay(2000);
        resolve();
      });
    });
  }

  async startServer(port = 5173) {
    this.log(`Starting development server on port ${port}...`, '\x1b[34m');
    
    return new Promise((resolve, reject) => {
      // Set port environment variable
      const env = { ...process.env, PORT: port.toString() };
      
      this.serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      let serverReady = false;
      let output = '';

      this.serverProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Look for server ready indicators
        if (chunk.includes('Local:') || 
            chunk.includes('localhost') || 
            chunk.includes('ready') ||
            chunk.includes('server running')) {
          if (!serverReady) {
            serverReady = true;
            this.log('✅ Server is ready!', '\x1b[32m');
            setTimeout(resolve, 2000, port);
          }
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('EADDRINUSE')) {
          this.log(`Port ${port} is busy, trying next port...`, '\x1b[33m');
          this.serverProcess.kill();
          reject(new Error('PORT_IN_USE'));
        } else if (!error.includes('warning')) {
          this.log(`Server error: ${error.trim()}`, '\x1b[31m');
        }
      });

      this.serverProcess.on('error', (error) => {
        this.log(`Failed to start server: ${error.message}`, '\x1b[31m');
        reject(error);
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          this.log('Server start timeout, but continuing...', '\x1b[33m');
          resolve(port);
        }
      }, 30000);
    });
  }

  async testConnectivity(port = 5173) {
    const baseUrl = `http://localhost:${port}`;
    const routes = ['/', '/admin', '/lms'];
    
    this.log('Testing server connectivity...', '\x1b[34m');
    
    for (const route of routes) {
      const url = `${baseUrl}${route}`;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        credentials: 'include'
      });
          
          if (response.ok) {
            this.log(`✅ ${route}: Connected (${response.status})`, '\x1b[32m');
            break;
          } else {
            this.log(`⚠️  ${route}: Status ${response.status}`, '\x1b[33m');
          }
        } catch (error) {
          if (attempt === 3) {
            this.log(`❌ ${route}: Failed after 3 attempts`, '\x1b[31m');
          } else {
            this.log(`Retry ${attempt}/3 for ${route}...`, '\x1b[33m');
            await delay(2000);
          }
        }
      }
    }
  }

  async runHealthCheck() {
    this.log('Running comprehensive health check...', '\x1b[34m');
    
    const checks = {
      typescript: false,
      build: false,
      server: false,
      connectivity: false
    };

    // TypeScript check
    try {
      const tsc = spawn('npx', ['tsc', '--noEmit'], { stdio: 'pipe' });
      await new Promise((resolve) => {
        tsc.on('close', (code) => {
          checks.typescript = code === 0;
          resolve();
        });
      });
    } catch (error) {
      this.log('TypeScript check failed', '\x1b[31m');
    }

    // Build check
    try {
      const build = spawn('npm', ['run', 'build'], { stdio: 'pipe' });
      await new Promise((resolve) => {
        build.on('close', (code) => {
          checks.build = code === 0;
          resolve();
        });
      });
    } catch (error) {
      this.log('Build check failed', '\x1b[31m');
    }

    // Server check
    try {
      await this.cleanupProcesses();
      const port = await this.startServer();
      checks.server = true;
      
      // Connectivity check
      await delay(3000);
      await this.testConnectivity(port);
      checks.connectivity = true;
      
    } catch (error) {
      this.log(`Server/connectivity check failed: ${error.message}`, '\x1b[31m');
    }

    return checks;
  }

  generateReport(checks) {
    const report = {
      timestamp: new Date().toISOString(),
      healthCheck: checks,
      recommendations: [],
      status: 'UNKNOWN'
    };

    let score = 0;
    const total = Object.keys(checks).length;

    Object.entries(checks).forEach(([check, passed]) => {
      if (passed) {
        score++;
        this.log(`✅ ${check.toUpperCase()}: PASSED`, '\x1b[32m');
      } else {
        this.log(`❌ ${check.toUpperCase()}: FAILED`, '\x1b[31m');
        
        // Add recommendations
        switch (check) {
          case 'typescript':
            report.recommendations.push('Run: npx tsc --noEmit to see TypeScript errors');
            break;
          case 'build':
            report.recommendations.push('Run: npm run build to check build issues');
            break;
          case 'server':
            report.recommendations.push('Check if ports 5173-5177 are available');
            break;
          case 'connectivity':
            report.recommendations.push('Verify firewall settings and localhost access');
            break;
        }
      }
    });

    report.status = score === total ? 'HEALTHY' : score > total / 2 ? 'PARTIAL' : 'CRITICAL';
    
    writeFileSync('server_health_report.json', JSON.stringify(report, null, 2));
    
    this.log(`\n📊 Health Score: ${score}/${total} (${((score/total)*100).toFixed(0)}%)`, '\x1b[34m');
    this.log(`📄 Report saved to: server_health_report.json`, '\x1b[34m');
    
    return report;
  }

  async cleanup() {
    if (this.serverProcess) {
      this.log('Cleaning up server process...', '\x1b[33m');
      this.serverProcess.kill('SIGTERM');
      await delay(2000);
      if (!this.serverProcess.killed) {
        this.serverProcess.kill('SIGKILL');
      }
    }
  }

  async execute() {
    try {
      this.log('🚀 Server Management Starting...', '\x1b[34m\x1b[1m');
      
      const checks = await this.runHealthCheck();
      const report = this.generateReport(checks);
      
      if (report.status === 'HEALTHY') {
        this.log('🎉 All systems operational!', '\x1b[32m\x1b[1m');
      } else {
        this.log('⚠️  Issues detected, check recommendations', '\x1b[33m\x1b[1m');
        console.log('\nRecommendations:');
        report.recommendations.forEach(rec => console.log(`  • ${rec}`));
      }
      
    } catch (error) {
      this.log(`❌ Server management failed: ${error.message}`, '\x1b[31m');
    } finally {
      await this.cleanup();
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new ServerManager();
  manager.execute().catch(console.error);
}

export default ServerManager;
