/** Lesson outlines checked against the public NeetCode course navigation, 2026-11-22.
 * Titles and sections only, not paid video/article content. */
export type LessonSeed = { course: 'beginner' | 'advanced'; section: string; title: string; position: number; url: string };
const courseRows: Record<'beginner' | 'advanced', Array<[string, string[]]>> = {
  beginner: [
    ['About', ['Introduction']],
    ['Arrays', ['RAM', 'Static Arrays', 'Dynamic Arrays', 'Stacks']],
    ['Linked Lists', ['Singly Linked Lists', 'Doubly Linked Lists', 'Queues']],
    ['Recursion', ['Factorial', 'Fibonacci Sequence']],
    ['Sorting', ['Insertion Sort', 'Merge Sort', 'Quick Sort', 'Bucket Sort']],
    ['Binary Search', ['Search Array', 'Search Range']],
    ['Trees', ['Binary Tree', 'Binary Search Tree', 'BST Insert and Remove', 'Depth-First Search', 'Breadth-First Search', 'BST Sets and Maps']],
    ['Backtracking', ['Tree Maze']],
    ['Heap / Priority Queue', ['Heap Properties', 'Push and Pop', 'Heapify']],
    ['Hashing', ['Hash Usage', 'Hash Implementation']],
    ['Graphs', ['Intro to Graphs', 'Matrix DFS', 'Matrix BFS', 'Adjacency List']],
    ['Dynamic Programming', ['1-Dimension DP', '2-Dimension DP']],
    ['Bit Manipulation', ['Bit Operations']]
  ],
  advanced: [
    ['Arrays', ["Kadane's Algorithm", 'Sliding Window Fixed Size', 'Sliding Window Variable Size', 'Two Pointers', 'Prefix Sums']],
    ['Linked Lists', ['Fast and Slow Pointers']],
    ['Trees', ['Trie', 'Union-Find', 'Segment Tree', 'Iterative DFS']],
    ['Heaps', ['Two Heaps']],
    ['Backtracking', ['Subsets', 'Combinations', 'Permutations']],
    ['Graphs', ["Dijkstra's", "Prim's", "Kruskal's", 'Topological Sort']],
    ['Dynamic Programming', ['0 / 1 Knapsack', 'Unbounded Knapsack', 'LCS', 'Palindromes']]
  ]
};
export const LESSONS: LessonSeed[] = (Object.entries(courseRows) as Array<[LessonSeed['course'], Array<[string,string[]]>]>).flatMap(([course, sections]) => {
  let position = 0;
  return sections.flatMap(([section, titles]) => titles.map(title => ({
    course, section, title, position,
    url: `https://neetcode.io/courses/${course === 'beginner' ? 'dsa-for-beginners' : 'advanced-algorithms'}/${position++}`
  })));
});
