/**
 * Programming problem bank for the demo seed.
 *
 * Test case wire format (consumed by the Phase 3 harness generator):
 *   input    — one JSON literal per line, in `harness.params` order
 *   expected — a single JSON literal matching `harness.returnType`
 *
 * Linked lists are given as a JSON array of values; binary trees as a
 * level-order JSON array with `null` for missing children.
 */

export interface SeedTestCase {
  input: string;
  expected: string;
  isHidden?: boolean;
}

export interface SeedProgrammingProblem {
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  category: string;
  points: number;
  tags: string[];
  description: string;
  constraints: string[];
  examples: { input: string; output: string; explanation?: string }[];
  harness: {
    funcName: string;
    params: { name: string; type: string }[];
    returnType: string;
    normalize?: 'sortArray' | 'sortRows';
  };
  starterCode: { python: string; javascript: string; cpp: string; java: string };
  hints: [string, string, string];
  testCases: SeedTestCase[];
}

export const PROGRAMMING_PROBLEMS: SeedProgrammingProblem[] = [
  // ─────────────────────────────────────────────────────────────── 1
  {
    title: 'Two Sum',
    difficulty: 'EASY',
    category: 'Arrays',
    points: 100,
    tags: ['array', 'hash-table'],
    description: [
      'Given an array of integers `nums` and an integer `target`, return the **indices of the two numbers** that add up to `target`.',
      '',
      'Each input has exactly one solution, and you may not use the same element twice. Return the indices in ascending order.',
    ].join('\n'),
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      'Exactly one valid answer exists',
    ],
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'nums[0] + nums[1] == 9, so the answer is [0, 1].',
      },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    harness: {
      funcName: 'twoSum',
      params: [
        { name: 'nums', type: 'intArray' },
        { name: 'target', type: 'int' },
      ],
      returnType: 'intArray',
    },
    starterCode: {
      python: 'def twoSum(nums, target):\n    # Write your solution here\n    pass\n',
      javascript: 'function twoSum(nums, target) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};\n',
      java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}\n',
    },
    hints: [
      'The brute force checks every pair. What information would let you skip the inner loop?',
      'While scanning left to right, you already know every value you have seen. For the current value `x`, you are looking for `target - x`.',
      'Keep a hash map from value to index. For each element, look up its complement first, then insert the element. One pass, O(n) time.',
    ],
    testCases: [
      { input: '[2,7,11,15]\n9', expected: '[0,1]' },
      { input: '[3,2,4]\n6', expected: '[1,2]' },
      { input: '[3,3]\n6', expected: '[0,1]' },
      { input: '[-1,-2,-3,-4,-5]\n-8', expected: '[2,4]', isHidden: true },
      { input: '[0,4,3,0]\n0', expected: '[0,3]', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 2
  {
    title: 'Valid Palindrome',
    difficulty: 'EASY',
    category: 'Strings',
    points: 100,
    tags: ['string', 'two-pointers'],
    description: [
      'A phrase is a **palindrome** if, after converting all uppercase letters to lowercase and removing every non-alphanumeric character, it reads the same forwards and backwards.',
      '',
      'Given a string `s`, return `true` if it is a palindrome, otherwise `false`.',
    ].join('\n'),
    constraints: ['1 <= s.length <= 2 * 10^5', 's consists of printable ASCII characters'],
    examples: [
      {
        input: 's = "A man, a plan, a canal: Panama"',
        output: 'true',
        explanation: '"amanaplanacanalpanama" is a palindrome.',
      },
      { input: 's = "race a car"', output: 'false' },
    ],
    harness: {
      funcName: 'isPalindrome',
      params: [{ name: 's', type: 'string' }],
      returnType: 'bool',
    },
    starterCode: {
      python: 'def isPalindrome(s):\n    # Write your solution here\n    pass\n',
      javascript: 'function isPalindrome(s) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    bool isPalindrome(string s) {\n        // Write your solution here\n        return false;\n    }\n};\n',
      java: 'class Solution {\n    public boolean isPalindrome(String s) {\n        // Write your solution here\n        return false;\n    }\n}\n',
    },
    hints: [
      'What exactly counts as a character worth comparing? Everything else can be ignored.',
      'You do not need to build a cleaned copy of the string. Two pointers can walk inwards, skipping characters that are not alphanumeric.',
      'Move `left` forward while `s[left]` is not alphanumeric, `right` backward likewise, then compare lowercased characters and step both inward.',
    ],
    testCases: [
      { input: '"A man, a plan, a canal: Panama"', expected: 'true' },
      { input: '"race a car"', expected: 'false' },
      { input: '" "', expected: 'true' },
      { input: '"0P"', expected: 'false', isHidden: true },
      { input: '"ab_a"', expected: 'true', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 3
  {
    title: 'Reverse Linked List',
    difficulty: 'EASY',
    category: 'Linked Lists',
    points: 120,
    tags: ['linked-list', 'recursion'],
    description: [
      'Given the `head` of a singly linked list, reverse the list and return the new head.',
      '',
      'The list is provided to your function as a `ListNode` chain and your return value is read back as an array of values.',
    ].join('\n'),
    constraints: ['0 <= number of nodes <= 5000', '-5000 <= Node.val <= 5000'],
    examples: [
      { input: 'head = [1,2,3,4,5]', output: '[5,4,3,2,1]' },
      { input: 'head = []', output: '[]' },
    ],
    harness: {
      funcName: 'reverseList',
      params: [{ name: 'head', type: 'listNode' }],
      returnType: 'listNode',
    },
    starterCode: {
      python:
        '# class ListNode:\n#     def __init__(self, val=0, next=None):\n#         self.val = val\n#         self.next = next\n\ndef reverseList(head):\n    # Write your solution here\n    pass\n',
      javascript:
        '// function ListNode(val, next) { this.val = val; this.next = next ?? null; }\n\nfunction reverseList(head) {\n  // Write your solution here\n}\n',
      cpp: '// struct ListNode { int val; ListNode *next; };\n\nclass Solution {\npublic:\n    ListNode* reverseList(ListNode* head) {\n        // Write your solution here\n        return nullptr;\n    }\n};\n',
      java: '// class ListNode { int val; ListNode next; }\n\nclass Solution {\n    public ListNode reverseList(ListNode head) {\n        // Write your solution here\n        return null;\n    }\n}\n',
    },
    hints: [
      'Reversing means every `next` pointer ends up pointing at the node that came before it.',
      'You need three references as you walk the list: the previous node, the current node, and the next node you are about to lose.',
      'Iterate: `nxt = cur.next; cur.next = prev; prev = cur; cur = nxt`. When `cur` is null, `prev` is the new head.',
    ],
    testCases: [
      { input: '[1,2,3,4,5]', expected: '[5,4,3,2,1]' },
      { input: '[1,2]', expected: '[2,1]' },
      { input: '[]', expected: '[]' },
      { input: '[7]', expected: '[7]', isHidden: true },
      { input: '[-1,0,1,-2]', expected: '[-2,1,0,-1]', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 4
  {
    title: 'Maximum Depth of Binary Tree',
    difficulty: 'EASY',
    category: 'Trees',
    points: 120,
    tags: ['tree', 'dfs', 'recursion'],
    description: [
      'Given the `root` of a binary tree, return its **maximum depth** — the number of nodes along the longest path from the root down to the farthest leaf.',
      '',
      'The tree is supplied in level order, with `null` marking a missing child.',
    ].join('\n'),
    constraints: ['0 <= number of nodes <= 10^4', '-100 <= Node.val <= 100'],
    examples: [
      {
        input: 'root = [3,9,20,null,null,15,7]',
        output: '3',
        explanation: 'The longest path is 3 -> 20 -> 15 (or 3 -> 20 -> 7).',
      },
      { input: 'root = []', output: '0' },
    ],
    harness: {
      funcName: 'maxDepth',
      params: [{ name: 'root', type: 'treeNode' }],
      returnType: 'int',
    },
    starterCode: {
      python:
        '# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n#         self.left = left\n#         self.right = right\n\ndef maxDepth(root):\n    # Write your solution here\n    pass\n',
      javascript:
        '// function TreeNode(val, left, right) { this.val = val; this.left = left ?? null; this.right = right ?? null; }\n\nfunction maxDepth(root) {\n  // Write your solution here\n}\n',
      cpp: '// struct TreeNode { int val; TreeNode *left; TreeNode *right; };\n\nclass Solution {\npublic:\n    int maxDepth(TreeNode* root) {\n        // Write your solution here\n        return 0;\n    }\n};\n',
      java: '// class TreeNode { int val; TreeNode left; TreeNode right; }\n\nclass Solution {\n    public int maxDepth(TreeNode root) {\n        // Write your solution here\n        return 0;\n    }\n}\n',
    },
    hints: [
      'What is the depth of an empty tree? That is your base case.',
      'If you already knew the depth of the left and right subtrees, how would you combine them?',
      '`maxDepth(node) = 1 + max(maxDepth(node.left), maxDepth(node.right))`, with `maxDepth(null) = 0`.',
    ],
    testCases: [
      { input: '[3,9,20,null,null,15,7]', expected: '3' },
      { input: '[1,null,2]', expected: '2' },
      { input: '[]', expected: '0' },
      { input: '[1,2,3,4,null,null,5,6]', expected: '4', isHidden: true },
      { input: '[0]', expected: '1', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 5
  {
    title: 'Longest Increasing Subsequence',
    difficulty: 'MEDIUM',
    category: 'Dynamic Programming',
    points: 200,
    tags: ['dp', 'binary-search', 'array'],
    description: [
      'Given an integer array `nums`, return the length of the **longest strictly increasing subsequence**.',
      '',
      'A subsequence is derived by deleting zero or more elements without changing the order of the remaining elements.',
    ].join('\n'),
    constraints: ['1 <= nums.length <= 2500', '-10^4 <= nums[i] <= 10^4'],
    examples: [
      {
        input: 'nums = [10,9,2,5,3,7,101,18]',
        output: '4',
        explanation: 'The LIS is [2,3,7,101], of length 4.',
      },
      { input: 'nums = [7,7,7,7,7]', output: '1' },
    ],
    harness: {
      funcName: 'lengthOfLIS',
      params: [{ name: 'nums', type: 'intArray' }],
      returnType: 'int',
    },
    starterCode: {
      python: 'def lengthOfLIS(nums):\n    # Write your solution here\n    pass\n',
      javascript: 'function lengthOfLIS(nums) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    int lengthOfLIS(vector<int>& nums) {\n        // Write your solution here\n        return 0;\n    }\n};\n',
      java: 'class Solution {\n    public int lengthOfLIS(int[] nums) {\n        // Write your solution here\n        return 0;\n    }\n}\n',
    },
    hints: [
      'Define `dp[i]` as the length of the longest increasing subsequence that **ends at** index `i`.',
      'For each `i`, look at every `j < i` with `nums[j] < nums[i]`. That gives an O(n^2) solution — enough to pass.',
      'For O(n log n): keep a `tails` array where `tails[k]` is the smallest possible tail of an increasing subsequence of length `k+1`, and binary search for the insertion point of each value.',
    ],
    testCases: [
      { input: '[10,9,2,5,3,7,101,18]', expected: '4' },
      { input: '[0,1,0,3,2,3]', expected: '4' },
      { input: '[7,7,7,7,7]', expected: '1' },
      { input: '[4,10,4,3,8,9]', expected: '3', isHidden: true },
      { input: '[-2,-1]', expected: '2', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 6
  {
    title: 'Group Anagrams',
    difficulty: 'MEDIUM',
    category: 'Hash Tables',
    points: 180,
    tags: ['hash-table', 'string', 'sorting'],
    description: [
      'Given an array of strings `strs`, group the anagrams together and return the groups.',
      '',
      'Groups may be returned in any order, and the strings within a group in any order — the grader sorts both before comparing.',
    ].join('\n'),
    constraints: [
      '1 <= strs.length <= 10^4',
      '0 <= strs[i].length <= 100',
      'strs[i] consists of lowercase English letters',
    ],
    examples: [
      {
        input: 'strs = ["eat","tea","tan","ate","nat","bat"]',
        output: '[["ate","eat","tea"],["bat"],["nat","tan"]]',
        explanation: '"eat", "tea" and "ate" use the same letters, so they form one group.',
      },
      { input: 'strs = [""]', output: '[[""]]' },
    ],
    harness: {
      funcName: 'groupAnagrams',
      params: [{ name: 'strs', type: 'stringArray' }],
      returnType: 'grid',
      normalize: 'sortRows',
    },
    starterCode: {
      python: 'def groupAnagrams(strs):\n    # Write your solution here\n    pass\n',
      javascript: 'function groupAnagrams(strs) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    vector<vector<string>> groupAnagrams(vector<string>& strs) {\n        // Write your solution here\n        return {};\n    }\n};\n',
      java: 'import java.util.*;\n\nclass Solution {\n    public List<List<String>> groupAnagrams(String[] strs) {\n        // Write your solution here\n        return new ArrayList<>();\n    }\n}\n',
    },
    hints: [
      'Two words are anagrams exactly when something about them is identical. What can you compute from a word that is the same for all of its anagrams?',
      'Sorting the letters of a word gives a canonical key — "eat" and "tea" both become "aet".',
      'Build a hash map from that key to a list of words, then return the map values. Counting letters into a 26-length tuple is an O(n·k) alternative to sorting.',
    ],
    testCases: [
      {
        input: '["eat","tea","tan","ate","nat","bat"]',
        expected: '[["ate","eat","tea"],["bat"],["nat","tan"]]',
      },
      { input: '[""]', expected: '[[""]]' },
      { input: '["a"]', expected: '[["a"]]' },
      {
        input: '["abc","bca","cab","xyz","zyx"]',
        expected: '[["abc","bca","cab"],["xyz","zyx"]]',
        isHidden: true,
      },
      {
        input: '["ddddddddddg","dgggggggggg"]',
        expected: '[["ddddddddddg"],["dgggggggggg"]]',
        isHidden: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 7
  {
    title: 'Number of Islands',
    difficulty: 'MEDIUM',
    category: 'Graphs',
    points: 200,
    tags: ['graph', 'dfs', 'bfs', 'matrix'],
    description: [
      'Given an `m x n` grid where `"1"` is land and `"0"` is water, return the number of **islands**.',
      '',
      'An island is surrounded by water and is formed by connecting adjacent land cells horizontally or vertically. Assume all four edges of the grid are surrounded by water.',
    ].join('\n'),
    constraints: ['1 <= m, n <= 300', 'grid[i][j] is "0" or "1"'],
    examples: [
      {
        input: 'grid = [["1","1","0"],["1","0","0"],["0","0","1"]]',
        output: '2',
        explanation: 'The connected block in the top-left counts once; the lone cell bottom-right is the second island.',
      },
    ],
    harness: {
      funcName: 'numIslands',
      params: [{ name: 'grid', type: 'grid' }],
      returnType: 'int',
    },
    starterCode: {
      python: 'def numIslands(grid):\n    # Write your solution here\n    pass\n',
      javascript: 'function numIslands(grid) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    int numIslands(vector<vector<string>>& grid) {\n        // Write your solution here\n        return 0;\n    }\n};\n',
      java: 'class Solution {\n    public int numIslands(String[][] grid) {\n        // Write your solution here\n        return 0;\n    }\n}\n',
    },
    hints: [
      'Every island is discovered exactly once — from the first land cell you happen to reach.',
      'When you find an unvisited land cell, increment the counter and then flood the entire connected region so it is never counted again.',
      'DFS or BFS from that cell, marking each visited land cell (overwrite it with "0" or keep a visited set). The counter is your answer.',
    ],
    testCases: [
      { input: '[["1","1","0"],["1","0","0"],["0","0","1"]]', expected: '2' },
      {
        input: '[["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]',
        expected: '1',
      },
      { input: '[["0"]]', expected: '0' },
      {
        input: '[["1","0","1","0","1"],["0","1","0","1","0"],["1","0","1","0","1"]]',
        expected: '8',
        isHidden: true,
      },
      { input: '[["1"]]', expected: '1', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 8
  {
    title: 'Valid Parentheses',
    difficulty: 'EASY',
    category: 'Stacks',
    points: 100,
    tags: ['stack', 'string'],
    description: [
      'Given a string `s` containing only the characters `()[]{}`, determine whether the input is valid.',
      '',
      'A string is valid when every bracket is closed by the same type of bracket, and brackets are closed in the correct order.',
    ].join('\n'),
    constraints: ['1 <= s.length <= 10^4', 's consists of parentheses characters only'],
    examples: [
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
      { input: 's = "([)]"', output: 'false', explanation: 'The brackets close in the wrong order.' },
    ],
    harness: {
      funcName: 'isValid',
      params: [{ name: 's', type: 'string' }],
      returnType: 'bool',
    },
    starterCode: {
      python: 'def isValid(s):\n    # Write your solution here\n    pass\n',
      javascript: 'function isValid(s) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    bool isValid(string s) {\n        // Write your solution here\n        return false;\n    }\n};\n',
      java: 'class Solution {\n    public boolean isValid(String s) {\n        // Write your solution here\n        return false;\n    }\n}\n',
    },
    hints: [
      'Which bracket must a closing bracket match? Always the most recently opened one that is still unclosed.',
      '"Most recent, still open" is exactly the behaviour of a stack.',
      'Push opening brackets. On a closing bracket, the stack must be non-empty and its top must be the matching opener — pop it. At the end the stack must be empty.',
    ],
    testCases: [
      { input: '"()"', expected: 'true' },
      { input: '"()[]{}"', expected: 'true' },
      { input: '"(]"', expected: 'false' },
      { input: '"([)]"', expected: 'false', isHidden: true },
      { input: '"{[]}"', expected: 'true', isHidden: true },
      { input: '"]"', expected: 'false', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 9
  {
    title: 'N-Queens Count',
    difficulty: 'HARD',
    category: 'Backtracking',
    points: 300,
    tags: ['backtracking', 'recursion', 'bitmask'],
    description: [
      'The **n-queens** puzzle places `n` queens on an `n x n` chessboard so that no two queens attack each other.',
      '',
      'Given an integer `n`, return the number of distinct solutions.',
    ].join('\n'),
    constraints: ['1 <= n <= 9'],
    examples: [
      {
        input: 'n = 4',
        output: '2',
        explanation: 'There are exactly two distinct placements of 4 non-attacking queens.',
      },
      { input: 'n = 1', output: '1' },
    ],
    harness: {
      funcName: 'totalNQueens',
      params: [{ name: 'n', type: 'int' }],
      returnType: 'int',
    },
    starterCode: {
      python: 'def totalNQueens(n):\n    # Write your solution here\n    pass\n',
      javascript: 'function totalNQueens(n) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    int totalNQueens(int n) {\n        // Write your solution here\n        return 0;\n    }\n};\n',
      java: 'class Solution {\n    public int totalNQueens(int n) {\n        // Write your solution here\n        return 0;\n    }\n}\n',
    },
    hints: [
      'Exactly one queen goes in each row, so place them row by row and only decide which column to use.',
      'Before placing at (row, col), you must know whether that column or either diagonal is already occupied. Track three sets.',
      'The two diagonals through a cell are identified by `row - col` (shift by n to keep it non-negative) and `row + col`. Add on the way down, remove on the way back up.',
    ],
    testCases: [
      { input: '4', expected: '2' },
      { input: '1', expected: '1' },
      { input: '5', expected: '10' },
      { input: '6', expected: '4', isHidden: true },
      { input: '8', expected: '92', isHidden: true },
    ],
  },

  // ─────────────────────────────────────────────────────────────── 10
  {
    title: 'Container With Most Water',
    difficulty: 'MEDIUM',
    category: 'Two Pointers',
    points: 180,
    tags: ['two-pointers', 'array', 'greedy'],
    description: [
      'You are given an integer array `height` of length `n`, where `height[i]` is the height of the vertical line drawn at position `i`.',
      '',
      'Pick two lines that, together with the x-axis, form a container holding the most water. Return that maximum area.',
    ].join('\n'),
    constraints: ['2 <= height.length <= 10^5', '0 <= height[i] <= 10^4'],
    examples: [
      {
        input: 'height = [1,8,6,2,5,4,8,3,7]',
        output: '49',
        explanation: 'The lines at indices 1 and 8 hold 7 * min(8,7) = 49 units of water.',
      },
      { input: 'height = [1,1]', output: '1' },
    ],
    harness: {
      funcName: 'maxArea',
      params: [{ name: 'height', type: 'intArray' }],
      returnType: 'int',
    },
    starterCode: {
      python: 'def maxArea(height):\n    # Write your solution here\n    pass\n',
      javascript: 'function maxArea(height) {\n  // Write your solution here\n}\n',
      cpp: 'class Solution {\npublic:\n    int maxArea(vector<int>& height) {\n        // Write your solution here\n        return 0;\n    }\n};\n',
      java: 'class Solution {\n    public int maxArea(int[] height) {\n        // Write your solution here\n        return 0;\n    }\n}\n',
    },
    hints: [
      'The area between two lines is `(j - i) * min(height[i], height[j])` — width times the shorter line.',
      'Start with the widest possible container: one pointer at each end. Any move inward loses width, so it can only help if the height improves.',
      'Move the pointer at the **shorter** line inward — keeping it can never beat the current area, because width only shrinks.',
    ],
    testCases: [
      { input: '[1,8,6,2,5,4,8,3,7]', expected: '49' },
      { input: '[1,1]', expected: '1' },
      { input: '[4,3,2,1,4]', expected: '16' },
      { input: '[1,2,1]', expected: '2', isHidden: true },
      { input: '[2,3,4,5,18,17,6]', expected: '17', isHidden: true },
    ],
  },
];
