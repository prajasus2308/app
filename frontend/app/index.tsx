import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRobotStore } from '../store/robotStore';

const { width: screenWidth } = Dimensions.get('window');
const CANVAS_WIDTH = Math.max(screenWidth - 32, 300);
const CANVAS_HEIGHT = 400;
const GRID_SIZE = 20;
const ROBOT_SIZE = 15;

type Command = {
  id: string;
  action: 'forward' | 'backward' | 'left' | 'right' | 'stop';
  distance?: number;
};

type Position = {
  x: number;
  y: number;
  angle: number;
};

type Obstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Environment = {
  name: string;
  obstacles: Obstacle[];
};

const ENVIRONMENTS: Environment[] = [
  {
    name: 'Open Space',
    obstacles: [
      { x: 0, y: 0, width: CANVAS_WIDTH, height: 5 },
      { x: 0, y: CANVAS_HEIGHT - 5, width: CANVAS_WIDTH, height: 5 },
      { x: 0, y: 0, width: 5, height: CANVAS_HEIGHT },
      { x: CANVAS_WIDTH - 5, y: 0, width: 5, height: CANVAS_HEIGHT },
    ],
  },
  {
    name: 'Simple Maze',
    obstacles: [
      { x: 0, y: 0, width: CANVAS_WIDTH, height: 5 },
      { x: 0, y: CANVAS_HEIGHT - 5, width: CANVAS_WIDTH, height: 5 },
      { x: 0, y: 0, width: 5, height: CANVAS_HEIGHT },
      { x: CANVAS_WIDTH - 5, y: 0, width: 5, height: CANVAS_HEIGHT },
      { x: 100, y: 100, width: 150, height: 20 },
      { x: 250, y: 200, width: 20, height: 150 },
    ],
  },
  {
    name: 'Obstacle Course',
    obstacles: [
      { x: 0, y: 0, width: CANVAS_WIDTH, height: 5 },
      { x: 0, y: CANVAS_HEIGHT - 5, width: CANVAS_WIDTH, height: 5 },
      { x: 0, y: 0, width: 5, height: CANVAS_HEIGHT },
      { x: CANVAS_WIDTH - 5, y: 0, width: 5, height: CANVAS_HEIGHT },
      { x: 80, y: 80, width: 40, height: 40 },
      { x: 200, y: 150, width: 60, height: 30 },
      { x: 150, y: 280, width: 50, height: 50 },
    ],
  },
];

export default function Index() {
  const [position, setPosition] = useState<Position>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    angle: 0,
  });
  const [commands, setCommands] = useState<Command[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentEnvironment, setCurrentEnvironment] = useState<Environment>(ENVIRONMENTS[0]);
  const [sensors, setSensors] = useState({ front: 0, left: 0, right: 0 });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [programName, setProgramName] = useState('');
  const [savedPrograms, setSavedPrograms] = useState<any[]>([]);
  const executionRef = useRef<NodeJS.Timeout | null>(null);

  const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    updateSensors();
  }, [position, currentEnvironment]);

  useEffect(() => {
    loadSavedPrograms();
  }, []);

  const loadSavedPrograms = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/programs`);
      if (response.ok) {
        const data = await response.json();
        setSavedPrograms(data);
      }
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  const checkCollision = (newX: number, newY: number): boolean => {
    for (const obstacle of currentEnvironment.obstacles) {
      if (
        newX >= obstacle.x &&
        newX <= obstacle.x + obstacle.width &&
        newY >= obstacle.y &&
        newY <= obstacle.y + obstacle.height
      ) {
        return true;
      }
    }
    return false;
  };

  const calculateDistance = (x: number, y: number, angle: number): number => {
    let distance = 0;
    const step = 5;
    let testX = x;
    let testY = y;
    const maxDistance = 200;

    while (distance < maxDistance) {
      testX += Math.cos((angle * Math.PI) / 180) * step;
      testY += Math.sin((angle * Math.PI) / 180) * step;

      if (checkCollision(testX, testY)) {
        break;
      }
      distance += step;
    }

    return Math.min(distance, maxDistance);
  };

  const updateSensors = () => {
    const frontDistance = calculateDistance(position.x, position.y, position.angle);
    const leftDistance = calculateDistance(position.x, position.y, position.angle - 90);
    const rightDistance = calculateDistance(position.x, position.y, position.angle + 90);

    setSensors({
      front: Math.round(frontDistance),
      left: Math.round(leftDistance),
      right: Math.round(rightDistance),
    });
  };

  const moveRobot = (action: Command['action']) => {
    setPosition((prev) => {
      let newPos = { ...prev };
      const moveDistance = 5;

      switch (action) {
        case 'forward':
          const newX = prev.x + Math.cos((prev.angle * Math.PI) / 180) * moveDistance;
          const newY = prev.y + Math.sin((prev.angle * Math.PI) / 180) * moveDistance;
          if (!checkCollision(newX, newY)) {
            newPos.x = newX;
            newPos.y = newY;
          }
          break;
        case 'backward':
          const backX = prev.x - Math.cos((prev.angle * Math.PI) / 180) * moveDistance;
          const backY = prev.y - Math.sin((prev.angle * Math.PI) / 180) * moveDistance;
          if (!checkCollision(backX, backY)) {
            newPos.x = backX;
            newPos.y = backY;
          }
          break;
        case 'left':
          newPos.angle = (prev.angle - 15 + 360) % 360;
          break;
        case 'right':
          newPos.angle = (prev.angle + 15) % 360;
          break;
      }

      return newPos;
    });
  };

  const addCommand = (action: Command['action']) => {
    const newCommand: Command = {
      id: Date.now().toString(),
      action,
    };
    setCommands([...commands, newCommand]);
  };

  const executeCommands = async () => {
    if (commands.length === 0 || isExecuting) return;

    setIsExecuting(true);
    for (const command of commands) {
      await new Promise((resolve) => {
        executionRef.current = setTimeout(() => {
          moveRobot(command.action);
          resolve(null);
        }, 200);
      });
    }
    setIsExecuting(false);
  };

  const clearCommands = () => {
    if (executionRef.current) {
      clearTimeout(executionRef.current);
    }
    setCommands([]);
    setIsExecuting(false);
  };

  const resetRobot = () => {
    if (executionRef.current) {
      clearTimeout(executionRef.current);
    }
    setPosition({
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      angle: 0,
    });
    setIsExecuting(false);
  };

  const saveProgram = async () => {
    if (!programName.trim()) {
      Alert.alert('Error', 'Please enter a program name');
      return;
    }

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: programName,
          commands: commands,
          environment: currentEnvironment.name,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Program saved successfully!');
        setProgramName('');
        setShowSaveModal(false);
        loadSavedPrograms();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save program');
    }
  };

  const loadProgram = (program: any) => {
    setCommands(program.commands);
    const env = ENVIRONMENTS.find((e) => e.name === program.environment);
    if (env) setCurrentEnvironment(env);
    setShowLoadModal(false);
    resetRobot();
    Alert.alert('Success', `Loaded program: ${program.name}`);
  };

  const deleteProgram = async (programId: string) => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/programs/${programId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        loadSavedPrograms();
      }
    } catch (error) {
      console.error('Error deleting program:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="hardware-chip" size={32} color="#4CAF50" />
              <Text style={styles.title}>Robotics Simulator</Text>
            </View>
            <Text style={styles.authorName}>by Pratyush Raj</Text>
          </View>
        </View>

        {/* Environment Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Environment</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {ENVIRONMENTS.map((env) => (
              <TouchableOpacity
                key={env.name}
                style={[
                  styles.envButton,
                  currentEnvironment.name === env.name && styles.envButtonActive,
                ]}
                onPress={() => {
                  setCurrentEnvironment(env);
                  resetRobot();
                }}
              >
                <Text
                  style={[
                    styles.envButtonText,
                    currentEnvironment.name === env.name && styles.envButtonTextActive,
                  ]}
                >
                  {env.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Canvas */}
        <View style={styles.canvasContainer}>
          <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={styles.canvas}>
            {/* Grid */}
            {Array.from({ length: CANVAS_WIDTH / GRID_SIZE }).map((_, i) => (
              <Line
                key={`v${i}`}
                x1={i * GRID_SIZE}
                y1={0}
                x2={i * GRID_SIZE}
                y2={CANVAS_HEIGHT}
                stroke="#333"
                strokeWidth="0.5"
              />
            ))}
            {Array.from({ length: CANVAS_HEIGHT / GRID_SIZE }).map((_, i) => (
              <Line
                key={`h${i}`}
                x1={0}
                y1={i * GRID_SIZE}
                x2={CANVAS_WIDTH}
                y2={i * GRID_SIZE}
                stroke="#333"
                strokeWidth="0.5"
              />
            ))}

            {/* Obstacles */}
            {currentEnvironment.obstacles.map((obstacle, index) => (
              <Rect
                key={index}
                x={obstacle.x}
                y={obstacle.y}
                width={obstacle.width}
                height={obstacle.height}
                fill="#FF5722"
              />
            ))}

            {/* Robot */}
            <Circle cx={position.x} cy={position.y} r={ROBOT_SIZE} fill="#4CAF50" />
            <Polygon
              points={`${position.x + Math.cos((position.angle * Math.PI) / 180) * ROBOT_SIZE},${position.y + Math.sin((position.angle * Math.PI) / 180) * ROBOT_SIZE} ${position.x + Math.cos(((position.angle + 140) * Math.PI) / 180) * (ROBOT_SIZE / 2)},${position.y + Math.sin(((position.angle + 140) * Math.PI) / 180) * (ROBOT_SIZE / 2)} ${position.x + Math.cos(((position.angle - 140) * Math.PI) / 180) * (ROBOT_SIZE / 2)},${position.y + Math.sin(((position.angle - 140) * Math.PI) / 180) * (ROBOT_SIZE / 2)}`}
              fill="#FFC107"
            />
          </Svg>
        </View>

        {/* Sensor Display */}
        <View style={styles.sensorsContainer}>
          <View style={styles.sensorItem}>
            <Ionicons name="arrow-up" size={20} color="#2196F3" />
            <Text style={styles.sensorText}>Front: {sensors.front}px</Text>
          </View>
          <View style={styles.sensorItem}>
            <Ionicons name="arrow-back" size={20} color="#2196F3" />
            <Text style={styles.sensorText}>Left: {sensors.left}px</Text>
          </View>
          <View style={styles.sensorItem}>
            <Ionicons name="arrow-forward" size={20} color="#2196F3" />
            <Text style={styles.sensorText}>Right: {sensors.right}px</Text>
          </View>
        </View>

        {/* Control Panel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controls</Text>
          <View style={styles.controlGrid}>
            <View style={styles.controlRow}>
              <View style={styles.controlSpacer} />
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => moveRobot('forward')}
                disabled={isExecuting}
              >
                <Ionicons name="arrow-up" size={28} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.controlSpacer} />
            </View>
            <View style={styles.controlRow}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => moveRobot('left')}
                disabled={isExecuting}
              >
                <Ionicons name="arrow-back" size={28} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={resetRobot}
              >
                <Ionicons name="stop" size={28} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => moveRobot('right')}
                disabled={isExecuting}
              >
                <Ionicons name="arrow-forward" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.controlRow}>
              <View style={styles.controlSpacer} />
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => moveRobot('backward')}
                disabled={isExecuting}
              >
                <Ionicons name="arrow-down" size={28} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.controlSpacer} />
            </View>
          </View>
        </View>

        {/* Command Queue Panel */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Command Queue ({commands.length})</Text>
            <TouchableOpacity style={styles.iconButton} onPress={clearCommands}>
              <Ionicons name="trash" size={20} color="#F44336" />
            </TouchableOpacity>
          </View>

          <View style={styles.commandButtons}>
            <TouchableOpacity
              style={styles.commandButton}
              onPress={() => addCommand('forward')}
              disabled={isExecuting}
            >
              <Ionicons name="arrow-up" size={20} color="#FFF" />
              <Text style={styles.commandButtonText}>Add Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commandButton}
              onPress={() => addCommand('left')}
              disabled={isExecuting}
            >
              <Ionicons name="arrow-back" size={20} color="#FFF" />
              <Text style={styles.commandButtonText}>Add Left</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commandButton}
              onPress={() => addCommand('right')}
              disabled={isExecuting}
            >
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
              <Text style={styles.commandButtonText}>Add Right</Text>
            </TouchableOpacity>
          </View>

          {commands.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.commandList}>
              {commands.map((cmd, index) => (
                <View key={cmd.id} style={styles.commandChip}>
                  <Text style={styles.commandChipText}>
                    {index + 1}. {cmd.action}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.executeButton, isExecuting && styles.executeButtonDisabled]}
            onPress={executeCommands}
            disabled={isExecuting || commands.length === 0}
          >
            <Ionicons name="play" size={20} color="#FFF" />
            <Text style={styles.executeButtonText}>
              {isExecuting ? 'Executing...' : 'Execute Program'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Save/Load Panel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program Management</Text>
          <View style={styles.programButtons}>
            <TouchableOpacity
              style={styles.programButton}
              onPress={() => setShowSaveModal(true)}
              disabled={commands.length === 0}
            >
              <Ionicons name="save" size={20} color="#FFF" />
              <Text style={styles.programButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.programButton} onPress={() => setShowLoadModal(true)}>
              <Ionicons name="folder-open" size={20} color="#FFF" />
              <Text style={styles.programButtonText}>Load</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Save Modal */}
      <Modal visible={showSaveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Program</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter program name"
              placeholderTextColor="#888"
              value={programName}
              onChangeText={setProgramName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowSaveModal(false);
                  setProgramName('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveProgram}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Load Modal */}
      <Modal visible={showLoadModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Load Program</Text>
            <ScrollView style={styles.programList}>
              {savedPrograms.length === 0 ? (
                <Text style={styles.emptyText}>No saved programs</Text>
              ) : (
                savedPrograms.map((program) => (
                  <View key={program.id} style={styles.programItem}>
                    <TouchableOpacity
                      style={styles.programItemContent}
                      onPress={() => loadProgram(program)}
                    >
                      <Text style={styles.programItemName}>{program.name}</Text>
                      <Text style={styles.programItemDetails}>
                        {program.commands.length} commands • {program.environment}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteProgram(program.id)}>
                      <Ionicons name="trash" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { width: '100%' }]}
              onPress={() => setShowLoadModal(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginLeft: 12,
  },
  authorName: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 8,
    marginLeft: 44,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  canvasContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  canvas: {
    backgroundColor: '#222',
  },
  sensorsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  sensorItem: {
    alignItems: 'center',
  },
  sensorText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  envButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#2a2a2a',
  },
  envButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  envButtonText: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '500',
  },
  envButtonTextActive: {
    color: '#FFF',
  },
  controlGrid: {
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  controlButton: {
    width: 60,
    height: 60,
    backgroundColor: '#4CAF50',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  controlSpacer: {
    width: 60,
    margin: 4,
  },
  commandButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  commandButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  commandButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  commandList: {
    marginBottom: 12,
  },
  commandChip: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  commandChipText: {
    color: '#FFF',
    fontSize: 12,
  },
  executeButton: {
    flexDirection: 'row',
    backgroundColor: '#FF9800',
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  executeButtonDisabled: {
    backgroundColor: '#666',
  },
  executeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  programButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  programButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#673AB7',
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  programButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  iconButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  programList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  programItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  programItemContent: {
    flex: 1,
  },
  programItemName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  programItemDetails: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
});