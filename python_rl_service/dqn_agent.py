"""
Deep Q-Network (DQN) Agent for UI Personalization

This implements a DQN with:
- Experience replay buffer
- Target network
- Double DQN (optional)
- Prioritized experience replay (optional)
"""

import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from collections import deque
import random


class DQNetwork(nn.Module):
    """
    Deep Q-Network Neural Network
    
    Input: State vector (user context, current settings)
    Output: Q-values for each action
    """
    
    def __init__(self, state_size, action_size, hidden_sizes=[128, 64]):
        super(DQNetwork, self).__init__()
        
        layers = []
        input_size = state_size
        
        # Hidden layers
        for hidden_size in hidden_sizes:
            layers.append(nn.Linear(input_size, hidden_size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.2))
            input_size = hidden_size
        
        # Output layer
        layers.append(nn.Linear(input_size, action_size))
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, state):
        return self.network(state)


class ReplayBuffer:
    """Experience Replay Buffer"""
    
    def __init__(self, capacity=10000):
        self.buffer = deque(maxlen=capacity)
    
    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))
    
    def sample(self, batch_size):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        
        return (
            np.array(states),
            np.array(actions),
            np.array(rewards),
            np.array(next_states),
            np.array(dones)
        )
    
    def __len__(self):
        return len(self.buffer)


class DQNAgent:
    """
    Deep Q-Network Agent
    
    Parameters:
        state_size: Dimension of state space
        action_size: Number of possible actions
        learning_rate: Learning rate for optimizer
        gamma: Discount factor
        epsilon: Initial exploration rate
        epsilon_min: Minimum exploration rate
        epsilon_decay: Exploration decay rate
        batch_size: Training batch size
        update_frequency: Steps between target network updates
    """
    
    def __init__(
        self,
        state_size,
        action_size,
        learning_rate=0.001,
        gamma=0.99,
        epsilon=1.0,
        epsilon_min=0.01,
        epsilon_decay=0.995,
        batch_size=32,
        update_frequency=100
    ):
        self.state_size = state_size
        self.action_size = action_size
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_min = epsilon_min
        self.epsilon_decay = epsilon_decay
        self.batch_size = batch_size
        self.update_frequency = update_frequency
        
        # Device configuration
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Q-Networks
        self.q_network = DQNetwork(state_size, action_size).to(self.device)
        self.target_network = DQNetwork(state_size, action_size).to(self.device)
        self.target_network.load_state_dict(self.q_network.state_dict())
        
        # Optimizer
        self.optimizer = optim.Adam(self.q_network.parameters(), lr=learning_rate)
        self.loss_fn = nn.MSELoss()
        
        # Replay buffer
        self.memory = ReplayBuffer()
        
        # Training stats
        self.steps = 0
        self.episodes = 0
        self.losses = []
    
    def encode_state(self, state_dict):
        """
        Encode state dictionary into numerical vector
        
        Args:
            state_dict: {
                'fontSize': 'large',
                'theme': 'dark',
                'lineHeight': 1.6,
                'deviceType': 'mobile',
                'timeOfDay': 'evening'
            }
        
        Returns:
            numpy array of encoded state
        """
        # Font size encoding
        font_map = {'small': 0, 'medium': 1, 'large': 2, 'x-large': 3}
        font_size = font_map.get(state_dict.get('fontSize', 'medium'), 1)
        
        # Theme encoding
        theme_map = {'light': 0, 'dark': 1, 'auto': 2}
        theme = theme_map.get(state_dict.get('theme', 'light'), 0)
        
        # Line height (normalized)
        line_height = float(state_dict.get('lineHeight', 1.5)) / 2.0
        
        # Contrast mode
        contrast_map = {'normal': 0, 'high': 1}
        contrast = contrast_map.get(state_dict.get('contrastMode', 'normal'), 0)
        
        # Device type
        device_map = {'desktop': 0, 'mobile': 1, 'tablet': 2}
        device_type = device_map.get(state_dict.get('deviceType', 'desktop'), 0)
        
        # Time of day
        time_map = {'morning': 0, 'afternoon': 1, 'evening': 2, 'night': 3}
        time_of_day = time_map.get(state_dict.get('timeOfDay', 'afternoon'), 1)
        
        # Target size (normalized)
        target_size = float(state_dict.get('targetSize', 32)) / 40.0
        
        return np.array([
            font_size / 3.0,
            theme / 2.0,
            line_height,
            contrast,
            device_type / 2.0,
            time_of_day / 3.0,
            target_size
        ], dtype=np.float32)
    
    def choose_action(self, state, explore=True):
        """
        Choose action using epsilon-greedy policy
        
        Args:
            state: State dictionary or encoded state vector
            explore: Whether to use epsilon-greedy exploration
        
        Returns:
            action_index: Index of chosen action
        """
        # Encode state if needed
        if isinstance(state, dict):
            state = self.encode_state(state)
        
        # Exploration
        if explore and np.random.random() < self.epsilon:
            return np.random.randint(self.action_size)
        
        # Exploitation
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q_values = self.q_network(state_tensor)
            return q_values.argmax().item()
    
    def store_experience(self, state, action, reward, next_state, done=False):
        """Store experience in replay buffer"""
        if isinstance(state, dict):
            state = self.encode_state(state)
        if isinstance(next_state, dict):
            next_state = self.encode_state(next_state)
        
        self.memory.push(state, action, reward, next_state, done)
    
    def train_step(self):
        """
        Perform one training step using experience replay
        
        Returns:
            loss: Training loss
        """
        if len(self.memory) < self.batch_size:
            return None
        
        # Sample batch from replay buffer
        states, actions, rewards, next_states, dones = self.memory.sample(self.batch_size)
        
        # Convert to tensors
        states = torch.FloatTensor(states).to(self.device)
        actions = torch.LongTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(next_states).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)
        
        # Current Q-values
        current_q_values = self.q_network(states).gather(1, actions.unsqueeze(1))
        
        # Target Q-values (Double DQN)
        with torch.no_grad():
            # Use online network to select action
            next_actions = self.q_network(next_states).argmax(1).unsqueeze(1)
            # Use target network to evaluate action
            next_q_values = self.target_network(next_states).gather(1, next_actions)
            target_q_values = rewards.unsqueeze(1) + self.gamma * next_q_values * (1 - dones.unsqueeze(1))
        
        # Compute loss
        loss = self.loss_fn(current_q_values, target_q_values)
        
        # Optimize
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.q_network.parameters(), 1.0)
        self.optimizer.step()
        
        # Update target network
        self.steps += 1
        if self.steps % self.update_frequency == 0:
            self.target_network.load_state_dict(self.q_network.state_dict())
        
        # Decay epsilon
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
        
        # Store loss
        loss_value = loss.item()
        self.losses.append(loss_value)
        
        return loss_value
    
    def get_q_values(self, state):
        """Get Q-values for all actions given a state"""
        if isinstance(state, dict):
            state = self.encode_state(state)
        
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q_values = self.q_network(state_tensor)
            return q_values.cpu().numpy()[0]
    
    def save_model(self, filepath):
        """Save model weights"""
        torch.save({
            'q_network': self.q_network.state_dict(),
            'target_network': self.target_network.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'steps': self.steps,
            'episodes': self.episodes
        }, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath):
        """Load model weights"""
        checkpoint = torch.load(filepath, map_location=self.device)
        self.q_network.load_state_dict(checkpoint['q_network'])
        self.target_network.load_state_dict(checkpoint['target_network'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])
        self.epsilon = checkpoint.get('epsilon', self.epsilon_min)
        self.steps = checkpoint.get('steps', 0)
        self.episodes = checkpoint.get('episodes', 0)
        print(f"Model loaded from {filepath}")
    
    def get_stats(self):
        """Get training statistics"""
        return {
            'steps': self.steps,
            'episodes': self.episodes,
            'epsilon': self.epsilon,
            'buffer_size': len(self.memory),
            'avg_loss': np.mean(self.losses[-100:]) if self.losses else 0,
            'device': str(self.device)
        }
