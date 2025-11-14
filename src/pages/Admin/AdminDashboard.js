// Compatibility shim: re-export the TSX module as a .js entry so dev HMR
// and any runtime code requesting the .js path can resolve the module.
export { default } from './AdminDashboard.tsx';
