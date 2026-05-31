import { Landmark, GestureMatch, CustomGestureTemplate } from '../types';

// Helper to calculate Euclidean distance between two points
export function distance3D(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
}

// Subtracts Wrist position from all coordinates and scales by distance(Wrist -> Middle MCP)
export function normalizeHandLandmarks(landmarks: Landmark[]): Landmark[] {
  if (!landmarks || landmarks.length < 21) return [];

  const wrist = landmarks[0];
  
  // Coordinate shift (Relative to Wrist)
  const relative = landmarks.map(lm => ({
    x: lm.x - wrist.x,
    y: lm.y - wrist.y,
    z: lm.z - wrist.z
  }));

  // Scaling factor based on Middle MCP (9) to handle hands at different distances
  const middleMcp = relative[9];
  const scale = Math.sqrt(
    Math.pow(middleMcp.x, 2) +
    Math.pow(middleMcp.y, 2) +
    Math.pow(middleMcp.z, 2)
  ) || 1.0;

  return relative.map(lm => ({
    x: lm.x / scale,
    y: lm.y / scale,
    z: lm.z / scale
  }));
}

// Predefined Heuristic Classifier
export function classifyPredefinedGesture(
  landmarks: Landmark[],
  isLeftHand: boolean
): GestureMatch | null {
  if (!landmarks || landmarks.length < 21) return null;

  const rLms = normalizeHandLandmarks(landmarks);
  if (rLms.length === 0) return null;

  // Determine finger extension states in a scale-independent and orientation-independent way.
  // A finger is extended when the TIP is further from knuckle MCP than the PIP joint is from MCP.
  const isExtended = (tip: number, pip: number, mcp: number): boolean => {
    const dTipToMcp = Math.sqrt(
      Math.pow(rLms[tip].x - rLms[mcp].x, 2) +
      Math.pow(rLms[tip].y - rLms[mcp].y, 2) +
      Math.pow(rLms[tip].z - rLms[mcp].z, 2)
    );
    const dPipToMcp = Math.sqrt(
      Math.pow(rLms[pip].x - rLms[mcp].x, 2) +
      Math.pow(rLms[pip].y - rLms[mcp].y, 2) +
      Math.pow(rLms[pip].z - rLms[mcp].z, 2)
    );
    // Extended fingers have tips located far beyond the MCP joint compared to the PIP knuckle.
    return dTipToMcp > dPipToMcp * 1.12;
  };

  const indexOpen = isExtended(8, 6, 5);
  const middleOpen = isExtended(12, 10, 9);
  const ringOpen = isExtended(16, 14, 13);
  const pinkyOpen = isExtended(20, 18, 17);

  // Thumb extension is based on index-distance in 3D
  // Thumb joints: CMC(1), MCP(2), IP(3), TIP(4). Index MCP: 5.
  const thumbTip = rLms[4];
  const indexMcp = rLms[5];
  
  const dThumbTipToIndexMcp = Math.sqrt(
    Math.pow(thumbTip.x - indexMcp.x, 2) + 
    Math.pow(thumbTip.y - indexMcp.y, 2) +
    Math.pow(thumbTip.z - indexMcp.z, 2)
  );

  // Simple heuristic for thumb extended (normally > 1.0 or 0.95 on our normalized scale)
  const thumbOpen = dThumbTipToIndexMcp > 0.90;

  // Track coordinates of tips for additional checks
  const yWrist = 0; // relative wrist Y is 0
  
  // In screen space (Y increases downwards, so smaller Y means higher screen position)
  // Let's analyze our hand vectors to see directions
  const isHandUpright = rLms[9].y < 0; // Middle MCP is higher than Wrist

  // OK Sign check: Distance between Thumb Tip (4) and Index Tip (8)
  const dThumbTipToIndexTip = Math.sqrt(
    Math.pow(rLms[4].x - rLms[8].x, 2) +
    Math.pow(rLms[4].y - rLms[8].y, 2) +
    Math.pow(rLms[4].z - rLms[8].z, 2)
  );
  const isOkSign = dThumbTipToIndexTip < 0.38 && middleOpen && ringOpen && pinkyOpen;

  // Thumbs Up check: Thumb open, all other 4 fingers completely closed
  const otherFingersClosed = !indexOpen && !middleOpen && !ringOpen && !pinkyOpen;
  const isThumbsUp = thumbOpen && otherFingersClosed && handAngleIsUp(rLms);
  const isThumbsDown = thumbOpen && otherFingersClosed && handAngleIsDown(rLms);

  // 1. GOOD JOB (Thumbs Up)
  if (isThumbsUp) {
    return { name: 'GOOD JOB', confidence: 0.98 };
  }

  // 2. DISLIKE (Thumbs Down)
  if (isThumbsDown) {
    return { name: 'DISLIKE', confidence: 0.97 };
  }

  // 3. POWER TO (Closed Fist)
  if (!thumbOpen && !indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    return { name: 'POWER TO', confidence: 0.99 };
  }

  // 4. OK Sign (upright loop)
  if (isOkSign && isHandUpright) {
    return { name: 'OK', confidence: 0.96 };
  }

  // 5. A-HOLE Sign (inverted/turned down OK Sign)
  if (isOkSign && !isHandUpright) {
    return { name: 'A-HOLE', confidence: 0.95 };
  }

  // 6. GOOD LUCK (Crossed index + middle fingers)
  const dIndexTipToMiddleTip = Math.sqrt(
    Math.pow(rLms[8].x - rLms[12].x, 2) +
    Math.pow(rLms[8].y - rLms[12].y, 2) +
    Math.pow(rLms[8].z - rLms[12].z, 2)
  );
  if (indexOpen && middleOpen && !ringOpen && !pinkyOpen) {
    // If tips are extremely close while both index and middle are open, they are crossed
    if (dIndexTipToMiddleTip < 0.18) {
      return { name: 'GOOD LUCK', confidence: 0.94 };
    }
  }

  // 7. PEACE (Index & Middle open, widely spaced, ring/pinky/thumb closed)
  if (indexOpen && middleOpen && !ringOpen && !pinkyOpen && dIndexTipToMiddleTip >= 0.18) {
    return { name: 'PEACE', confidence: 0.98 };
  }

  // 8. ROCK (Index & Pinky open, middle & ring closed)
  if (indexOpen && pinkyOpen && !middleOpen && !ringOpen) {
    return { name: 'ROCK', confidence: 0.97 };
  }

  // 9. BANG BANG (Gun posture: Thumb up, Index extended horizontally, others closed)
  const isBangBang = thumbOpen && indexOpen && !middleOpen && !ringOpen && !pinkyOpen;
  if (isBangBang) {
    const isIndexHorizontal = Math.abs(rLms[8].y - rLms[5].y) < Math.abs(rLms[8].x - rLms[5].x);
    if (isIndexHorizontal) {
      return { name: 'BANG BANG', confidence: 0.95 };
    }
  }

  // 10. LOSER (L shape: Thumb up, Index vertical, others closed)
  if (isBangBang) {
    const isIndexVertical = Math.abs(rLms[8].y - rLms[5].y) > Math.abs(rLms[8].x - rLms[5].x);
    if (isIndexVertical) {
      return { name: 'LOSER', confidence: 0.96 };
    }
  }

  // 11. YOU (Only index finger pointing forward/up, thumb closed)
  if (indexOpen && !thumbOpen && !middleOpen && !ringOpen && !pinkyOpen) {
    return { name: 'YOU', confidence: 0.96 };
  }

  // 12. HANG LOOSE / 13. CALL ME (Thumb and pinky open, others closed)
  if (thumbOpen && pinkyOpen && !indexOpen && !middleOpen && !ringOpen) {
    // Call Me is tilted (slanted, e.g. angle of Pinky-to-Thumb is slanted)
    // Hang Loose is typically flat/upright
    const tilt = Math.abs(rLms[4].y - rLms[20].y);
    if (tilt > 0.4) {
      return { name: 'CALL ME', confidence: 0.94 };
    } else {
      return { name: 'HANG LOOSE', confidence: 0.95 };
    }
  }

  // 14. HIGH FIVE / 15. TALK TO THE HAND (All 5 extended)
  if (thumbOpen && indexOpen && middleOpen && ringOpen && pinkyOpen) {
    // Talk to the hand is directly facing the camera with tilted index tip
    if (rLms[8].z < -0.15) {
      return { name: 'TALK TO THE HAND', confidence: 0.95 };
    }
    return { name: 'HIGH FIVE', confidence: 0.98 };
  }

  // Fallbacks based on counting open fingers
  const openCount = [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;
  if (openCount === 5) {
    return { name: 'HIGH FIVE', confidence: 0.90 };
  } else if (openCount === 0) {
    return { name: 'POWER TO', confidence: 0.91 };
  }

  return null;
}

// Checks if thumb TIP behaves upwards
function handAngleIsUp(rLms: Landmark[]): boolean {
  // Thumb Tip (4) is higher (smaller screen y) than Thumb CMC (1) and MCP (2) and Pinky MCP (17)
  const tipY = rLms[4].y;
  const mcpY = rLms[2].y;
  const wristY = 0;
  return tipY < mcpY && rLms[4].y < rLms[17].y;
}

// Checks if thumb TIP behaves downwards
function handAngleIsDown(rLms: Landmark[]): boolean {
  const tipY = rLms[4].y;
  const mcpY = rLms[2].y;
  return tipY > mcpY && rLms[4].y > rLms[17].y;
}

function calculateConfidence(bools: boolean[], bias: number): number {
  const matches = bools.filter(Boolean).length;
  const ratio = matches / bools.length;
  return bias + (1.0 - bias) * ratio;
}

/*************************************************
 * Custom Template Gesture Recognition
 * - Matches a normalized hand pose against custom trainer templates
 * - Uses normalized cumulative Euclidean distance
 *************************************************/
export function classifyCustomGesture(
  landmarks: Landmark[],
  templates: CustomGestureTemplate[],
  threshold = 1.8 // Match limit distance sum (the lower, the stricter)
): GestureMatch | null {
  if (!landmarks || landmarks.length < 21 || templates.length === 0) return null;

  const userNorm = normalizeHandLandmarks(landmarks);
  if (userNorm.length === 0) return null;

  let bestMatch: CustomGestureTemplate | null = null;
  let minDistance = Infinity;

  for (const template of templates) {
    let distanceSum = 0;
    
    // Sum of distances for all 21 landmark pairs
    for (let i = 0; i < 21; i++) {
      const p1 = userNorm[i];
      const p2 = template.averageLandmarks[i];
      distanceSum += Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
      );
    }

    if (distanceSum < minDistance) {
      minDistance = distanceSum;
      bestMatch = template;
    }
  }

  // Convert distance sum to confidence percentage
  // If distanceSum is 0 => 100% confidence
  // If distanceSum is threshold => 0% confidence
  if (bestMatch && minDistance <= threshold) {
    const confidence = Math.max(0.5, 1 - (minDistance / (threshold * 1.5)));
    return {
      name: bestMatch.name,
      confidence: Math.round(confidence * 100) / 100,
      isCustom: true
    };
  }

  return null;
}
