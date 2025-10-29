export interface Player {
  name: string;
  score: number;
}

export interface Question {
  text: string;
  answers: string[]; // length 7
  revealed: boolean[]; // length 7, parallel to answers
}
