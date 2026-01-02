"""
Implicit Reward Calculator
Calculates reward from user behavior WITHOUT asking for feedback

Uses behavior signals:
- Time on page (optimal 2-5 minutes)
- Interaction count (natural engagement)
- Error count (UI quality)
- Scroll depth (content engagement)
- Task completion (goal achievement)
- Immediate reversion (strong negative signal!)
"""

import numpy as np
from typing import Dict, List, Tuple

class ImplicitRewardCalculator:
    def __init__(self):
        # Reward weights (must sum to 1.0)
        self.weights = {
            'time': 0.20,           # Time spent on page
            'interactions': 0.20,   # Number of interactions
            'errors': 0.15,         # Error count (inverse)
            'engagement': 0.15,     # Scroll depth + tasks
            'continuity': 0.30,     # Most important: did they keep the change?
        }
        
        # Expected ranges (tuned from research)
        self.optimal_time_range = (120, 300)  # 2-5 minutes in seconds
        self.expected_interactions = 10       # Baseline interaction count
        
    def calculate_session_reward(
        self,
        duration: float,
        interaction_count: int,
        error_count: int,
        scroll_depth: float,
        tasks_completed: int,
        immediate_reversion: bool
    ) -> Dict:
        """
        Calculate reward from a single session's behavior
        
        Args:
            duration: Time spent in milliseconds
            interaction_count: Number of clicks/interactions
            error_count: Number of errors encountered
            scroll_depth: Scroll depth (0.0 to 1.0)
            tasks_completed: Number of completed tasks
            immediate_reversion: Whether user reverted within 10s
        
        Returns:
            Dict with reward, confidence, and breakdown
        """
        duration_sec = duration / 1000.0  # Convert to seconds
        
        # Calculate individual scores (0.0 to 1.0)
        time_score = self._score_time(duration_sec)
        interaction_score = self._score_interactions(interaction_count)
        error_score = self._score_errors(error_count)
        engagement_score = self._score_engagement(scroll_depth, tasks_completed)
        continuity_score = self._score_continuity(immediate_reversion)
        
        # Weighted average
        reward = (
            self.weights['time'] * time_score +
            self.weights['interactions'] * interaction_score +
            self.weights['errors'] * error_score +
            self.weights['engagement'] * engagement_score +
            self.weights['continuity'] * continuity_score
        )
        
        # Confidence based on data quality
        confidence = self._calculate_confidence(
            duration_sec,
            interaction_count,
            scroll_depth
        )
        
        return {
            'reward': float(reward),
            'confidence': float(confidence),
            'breakdown': {
                'time': float(time_score),
                'interactions': float(interaction_score),
                'errors': float(error_score),
                'engagement': float(engagement_score),
                'continuity': float(continuity_score),
            }
        }
    
    def _score_time(self, duration_sec: float) -> float:
        """
        Score based on time spent
        
        Optimal: 2-5 minutes (120-300 seconds)
        Too short (<30s): Likely bounced (0.0)
        Too long (>10min): Confusion or distraction (0.3)
        """
        if duration_sec < 30:
            # Bounce - very negative
            return 0.0
        elif duration_sec < self.optimal_time_range[0]:
            # Too short but not a bounce
            return 0.5 * (duration_sec / self.optimal_time_range[0])
        elif duration_sec <= self.optimal_time_range[1]:
            # Optimal range - full score
            return 1.0
        elif duration_sec <= 600:
            # A bit long but okay
            decay = (duration_sec - self.optimal_time_range[1]) / 300
            return max(0.5, 1.0 - 0.5 * decay)
        else:
            # Very long - confusion or distraction
            return 0.3
    
    def _score_interactions(self, count: int) -> float:
        """
        Score based on interaction count
        
        Too few: Not engaging
        Optimal: Natural exploration
        Too many: Confusion or errors
        """
        if count < 5:
            # Very few interactions - not engaging
            return 0.3
        elif count < self.expected_interactions:
            # Building up to optimal
            return 0.3 + 0.7 * (count / self.expected_interactions)
        elif count <= self.expected_interactions * 2:
            # Optimal range
            return 1.0
        else:
            # Too many - might indicate confusion
            excess = count - (self.expected_interactions * 2)
            penalty = min(0.5, excess / 20)
            return max(0.4, 1.0 - penalty)
    
    def _score_errors(self, count: int) -> float:
        """
        Score based on errors (inverse - fewer is better)
        
        0 errors: Perfect (1.0)
        1-2 errors: Minor issues (0.7)
        3+ errors: Problematic (0.3)
        """
        if count == 0:
            return 1.0
        elif count <= 2:
            return 0.7
        elif count <= 5:
            return 0.4
        else:
            return 0.2
    
    def _score_engagement(
        self,
        scroll_depth: float,
        tasks_completed: int
    ) -> float:
        """
        Score based on content engagement
        
        Combines scroll depth and task completion
        """
        # Scroll component (0.0 to 0.5)
        scroll_score = min(0.5, scroll_depth * 0.5)
        
        # Task completion component (0.0 to 0.5)
        if tasks_completed == 0:
            task_score = 0.1  # Some baseline credit
        elif tasks_completed == 1:
            task_score = 0.3
        elif tasks_completed == 2:
            task_score = 0.5
        else:
            task_score = 0.5  # Cap at 0.5
        
        return scroll_score + task_score
    
    def _score_continuity(self, immediate_reversion: bool) -> float:
        """
        Score based on whether user kept the changes
        
        This is THE MOST IMPORTANT signal!
        Immediate reversion = strong rejection
        """
        if immediate_reversion:
            # User explicitly rejected the UI within 10 seconds
            # This is a VERY negative signal
            return 0.0
        else:
            # User kept the UI (implicit acceptance)
            return 1.0
    
    def _calculate_confidence(
        self,
        duration_sec: float,
        interaction_count: int,
        scroll_depth: float
    ) -> float:
        """
        Calculate confidence in the reward
        
        Higher confidence when:
        - Sufficient session duration
        - Meaningful interactions
        - Good scroll depth
        """
        confidence = 0.5  # Base confidence
        
        # Duration contribution
        if duration_sec >= 60:
            confidence += 0.2
        elif duration_sec >= 30:
            confidence += 0.1
        
        # Interaction contribution
        if interaction_count >= 5:
            confidence += 0.2
        elif interaction_count >= 3:
            confidence += 0.1
        
        # Scroll contribution
        if scroll_depth >= 0.5:
            confidence += 0.1
        
        return min(1.0, confidence)
    
    def aggregate_sessions(self, sessions: List[Dict]) -> Dict:
        """
        Aggregate rewards across multiple sessions
        
        Identifies patterns:
        - Consistent behavior
        - Improving/declining trends
        - Outliers
        """
        if not sessions:
            return {
                'average_reward': 0.0,
                'patterns': {}
            }
        
        rewards = [s.get('reward', 0.0) for s in sessions]
        
        # Calculate statistics
        avg_reward = np.mean(rewards)
        std_reward = np.std(rewards)
        trend = self._calculate_trend(rewards)
        
        # Pattern detection
        patterns = {
            'average': float(avg_reward),
            'std_dev': float(std_reward),
            'trend': trend,  # 'improving', 'stable', 'declining'
            'consistency': float(1.0 - min(1.0, std_reward)),
            'session_count': len(sessions)
        }
        
        return {
            'average_reward': float(avg_reward),
            'patterns': patterns
        }
    
    def _calculate_trend(self, rewards: List[float]) -> str:
        """Calculate if rewards are improving, stable, or declining"""
        if len(rewards) < 3:
            return 'insufficient_data'
        
        # Simple linear regression slope
        x = np.arange(len(rewards))
        slope = np.polyfit(x, rewards, 1)[0]
        
        if slope > 0.05:
            return 'improving'
        elif slope < -0.05:
            return 'declining'
        else:
            return 'stable'
