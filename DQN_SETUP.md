# DQN Setup Guide

## 1. Install Python Dependencies

```bash
cd python_rl_service
pip install -r requirements.txt
```

**Requirements:**
- Python 3.8+
- PyTorch
- Flask
- NumPy

## 2. Start Python DQN Service

```bash
cd python_rl_service
python app.py
```

Service will run on: `http://localhost:8000`

## 3. Start Node.js Backend

```bash
# In another terminal
cd C:\Users\TUF\Desktop\research\Optimization-Engine
node backend/api.js
```

Backend will run on: `http://localhost:5000`

## 4. Test DQN Integration

```bash
# Test DQN health
curl http://localhost:8000/rl/health

# Initialize agent
curl -X POST http://localhost:8000/rl/initialize \
  -H "Content-Type: application/json" \
  -d '{"userId": "u_001", "parameter": "fontSize"}'

# Get action recommendation
curl -X POST http://localhost:8000/rl/choose-action \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u_001",
    "parameter": "fontSize",
    "state": {
      "fontSize": "medium",
      "theme": "dark",
      "deviceType": "mobile"
    }
  }'
```

## Architecture

```
User Feedback
    ↓
Node.js Backend (port 5000)
    ↓ HTTP Request
Python DQN Service (port 8000)
    ↓
PyTorch Neural Network
    ↓
Experience Replay Buffer
    ↓
Model Training & Updates
```

## Environment Variables

Create `.env` in root:

```env
PYTHON_RL_URL=http://localhost:8000
MONGODB_URI=mongodb://localhost:27017/optimization-engine
PORT=5000
```

## Testing Flow

1. **Submit Feedback** → Node.js stores in MongoDB + sends to Python DQN
2. **DQN Trains** → Updates neural network weights
3. **Get Recommendation** → DQN chooses best action based on learned Q-values
4. **Fallback** → If Python service down, uses traditional Q-tables

## Model Persistence

Models are automatically saved to:
```
python_rl_service/models/
    u_001_fontSize.pth
    u_001_theme.pth
    ...
```

## GPU Support

DQN automatically uses CUDA if available:

```python
# Check GPU in Python console
import torch
print(torch.cuda.is_available())
print(torch.cuda.get_device_name(0))
```

## Production Deployment

### Option 1: Same Server
- Run both Node.js and Python on same machine
- Use PM2/systemd to manage processes

### Option 2: Separate Servers
- Deploy Python DQN on dedicated ML server
- Set `PYTHON_RL_URL=http://ml-server:8000`

### Docker Deployment

```dockerfile
# Dockerfile for Python DQN
FROM python:3.9
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```

```yaml
# docker-compose.yml
version: '3'
services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
  
  python-rl:
    build: ./python_rl_service
    ports:
      - "8000:8000"
    volumes:
      - ./models:/app/models
  
  nodejs-api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - PYTHON_RL_URL=http://python-rl:8000
      - MONGODB_URI=mongodb://mongodb:27017/optimization-engine
```

## Monitoring

Check DQN training statistics:

```bash
curl "http://localhost:8000/rl/stats?userId=u_001&parameter=fontSize"
```

Response:
```json
{
  "userId": "u_001",
  "parameter": "fontSize",
  "stats": {
    "steps": 1523,
    "episodes": 45,
    "epsilon": 0.15,
    "buffer_size": 1500,
    "avg_loss": 0.042,
    "device": "cuda:0"
  }
}
```
