import { QuantumChessBoard } from "../_components/QuantumChessBoard";
import PageHeader from "../_components/PageHeader";

export default function QuantumChessPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Games"
        title="Quantum Chess"
        subtitle="A novel chess variant with superposition pieces, limited moves, and phase-shift mechanics."
      />

      <div className="bg-white rounded-lg shadow p-8">
        <QuantumChessBoard />
      </div>

      <div className="bg-blue-50 rounded-lg shadow p-6 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold mb-4">How to Play Quantum Chess</h2>
        <div className="space-y-3 text-sm">
          <div>
            <strong className="block mb-1">Core Rules:</strong>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Standard chess piece movements apply</li>
              <li>Click a piece to select it and see valid moves (highlighted in green)</li>
              <li>Click a valid move square to move there</li>
              <li>Each player has a maximum of 30 moves before losing</li>
            </ul>
          </div>

          <div>
            <strong className="block mb-1">Phase Shift Mechanic:</strong>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Rooks and pawns can phase shift (jump through one piece) once per game</li>
              <li>Phase shifts ignore pieces blocking the path but still need a valid destination</li>
            </ul>
          </div>

          <div>
            <strong className="block mb-1">Victory Conditions:</strong>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Capture all opponent queens and rooks</li>
              <li>Make your 30 moves before opponent (unlimited moves left)</li>
              <li>Force opponent checkmate (same as standard chess)</li>
            </ul>
          </div>

          <div>
            <strong className="block mb-1">Visual Indicators:</strong>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>
                <span className="inline-block w-4 h-4 ring-2 ring-blue-500 mr-2"></span>
                Blue ring = selected piece
              </li>
              <li>
                <span className="inline-block w-4 h-4 ring-2 ring-green-500 mr-2"></span>
                Green ring = valid move destination
              </li>
              <li>
                <span className="inline-block w-4 h-4 bg-yellow-300 mr-2"></span>
                Yellow background = last move (from or to)
              </li>
            </ul>
          </div>

          <div>
            <strong className="block mb-1">⚛ Symbol:</strong>
            <p className="text-gray-700">
              Indicates a piece with an active quantum superposition state (not yet implemented in UI, reserved for future expansion)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
