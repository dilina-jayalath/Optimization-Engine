# Python DQN RL Service

Deep Q-Network (DQN) service for UI personalization using PyTorch.

## Installation

```bash
cd python_rl_service
pip install -r requirements.txt
```

## Run Service

```bash
python app.py
```

Service runs on: `http://localhost:8000`

## Architecture

- **DQN Agent**: Deep Q-Learning with experience replay
- **Neural Network**: 2-layer MLP with ReLU activation
- **Target Network**: Stabilizes training
- **Double DQN**: Reduces overestimation bias
- **Experience Replay**: Breaks correlation in training data

## API Endpoints

### Initialize Agent
```bash
curl -X POST http://localhost:8000/rl/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u_001",
    "parameter": "fontSize"
  }'
```

### Get Action Recommendation
```bash
curl -X POST http://localhost:8000/rl/choose-action \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u_001",
    "parameter": "fontSize",
    "state": {
      "fontSize": "medium",
      "theme": "dark",
      "deviceType": "mobile"
    },
    "explore": true
  }'
```

### Submit Feedback (Train)
```bash
curl -X POST http://localhost:8000/rl/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u_001",
    "parameter": "fontSize",
    "state": {...},
    "action": "large",
    "reward": 1.0,
    "nextState": {...}
  }'
```

### Get Training Statistics
```bash
curl -X GET "http://localhost:8000/rl/stats?userId=u_001&parameter=fontSize"
```

### Save Model
```bash
curl -X POST http://localhost:8000/rl/save \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u_001",
    "parameter": "fontSize"
  }'
```

## Model Architecture

```
Input (State): [7 features]
    ↓
Dense(128) + ReLU + Dropout(0.2)
    ↓
Dense(64) + ReLU + Dropout(0.2)
    ↓
Output (Q-values): [action_size]
```

## Training Process

1. **Experience Collection**: Store (state, action, reward, next_state) tuples
2. **Mini-batch Sampling**: Sample random batch from replay buffer
3. **Q-value Calculation**: Compute target Q-values using target network
4. **Loss Minimization**: Update Q-network using MSE loss
5. **Target Network Update**: Periodically sync target network
6. **Epsilon Decay**: Reduce exploration over time

## Features

- ✅ Deep Q-Network (DQN)
- ✅ Experience Replay Buffer
- ✅ Target Network
- ✅ Double DQN
- ✅ Epsilon-greedy exploration
- ✅ Gradient clipping
- ✅ Model save/load
- ✅ Batch training from historical data
- ✅ GPU support (CUDA)
