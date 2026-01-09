import { create } from 'zustand';

type RobotState = {
  isSimulating: boolean;
  setIsSimulating: (value: boolean) => void;
};

export const useRobotStore = create<RobotState>((set) => ({
  isSimulating: false,
  setIsSimulating: (value) => set({ isSimulating: value }),
}));