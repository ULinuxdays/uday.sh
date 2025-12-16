import React, { useState, useRef, useEffect, useReducer, useMemo } from 'react';
import { Prompt } from './Prompt';
import { Output, type HistoryItem } from './Output';
import { parseCommand } from '../../lib/parser';
import type { VirtualFS, DirectoryNode, FileNode, FSNode } from '../../lib/fs_types';

interface ShellProps {
    fs?: VirtualFS;
    initialCwd?: string;
    initialHistory?: HistoryItem[];
}

interface ShellState {
    history: HistoryItem[];
    commandHistory: string[];
    cwds: string[];
    currentCwd: string;
}

type Action =
    | { type: 'ADD_HISTORY'; item: HistoryItem }
    | { type: 'CLEAR_HISTORY' }
    | { type: 'ADD_COMMAND'; cmd: string }
    | { type: 'SET_CWD'; path: string }
    | { type: 'GO_BACK' }
    | { type: 'REPLACE_STATE'; newState: ShellState };

type AutocompleteSuggestion = {
    kind: 'command' | 'dir' | 'file';
    insertText: string;
    label: string;
};

type PathCompletionMode = 'dir' | 'file' | 'both';

type FixSuggestion = {
    command: string;
    label: string;
};

type TryChip = {
    command: string;
    label: string;
};

const AUTOCOMPLETE_COMMANDS: Array<{ name: string }> = [
    { name: 'help' },
    { name: 'cd' },
    { name: 'ls' },
    { name: 'open' },
    { name: 'cat' },
    { name: 'search' },
    { name: 'tree' },
    { name: 'home' },
    { name: 'back' },
    { name: 'clear' },
    { name: 'summary' },
    { name: 'pwd' },
];

const AUTOCOMPLETE_ALIASES: Record<string, string> = {
    '?': 'help',
    dir: 'ls',
    goto: 'cd',
    read: 'cat',
    tldr: 'summary',
};

const getMaxEditDistance = (queryLength: number): number => {
    if (queryLength <= 4) return 2;
    if (queryLength <= 8) return 3;
    return 4;
};

const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const aLen = a.length;
    const bLen = b.length;

    const prevRow = new Array<number>(bLen + 1);
    const nextRow = new Array<number>(bLen + 1);
    for (let j = 0; j <= bLen; j++) prevRow[j] = j;

    for (let i = 1; i <= aLen; i++) {
        nextRow[0] = i;
        const aChar = a.charCodeAt(i - 1);
        for (let j = 1; j <= bLen; j++) {
            const cost = aChar === b.charCodeAt(j - 1) ? 0 : 1;
            nextRow[j] = Math.min(
                prevRow[j] + 1, // deletion
                nextRow[j - 1] + 1, // insertion
                prevRow[j - 1] + cost // substitution
            );
        }
        for (let j = 0; j <= bLen; j++) prevRow[j] = nextRow[j];
    }

    return prevRow[bLen];
};

const rankCandidates = (query: string, candidates: string[], limit: number): string[] => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) return candidates.slice(0, limit);

    const maxDistance = getMaxEditDistance(normalizedQuery.length);
    return candidates
        .map((candidate) => {
            const normalizedCandidate = candidate.toLowerCase();
            const startsWith = normalizedCandidate.startsWith(normalizedQuery);
            const includes = normalizedCandidate.includes(normalizedQuery);
            const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);
            const group = startsWith ? 0 : includes ? 1 : 2;
            const score = group * 100 + distance;
            return { candidate, startsWith, includes, distance, score };
        })
        .filter((row) => row.startsWith || row.includes || row.distance <= maxDistance)
        .sort((a, b) => a.score - b.score || a.candidate.localeCompare(b.candidate))
        .slice(0, limit)
        .map((row) => row.candidate);
};

const pickRandomItem = <T,>(items: T[]): T | null => {
    if (items.length === 0) return null;
    const idx = Math.floor(Math.random() * items.length);
    return items[idx] ?? null;
};

const getAge = (now: Date): number => {
    const birthYear = 2009;
    const birthMonthIndex = 9; // October (0-based)
    const birthDay = 17;

    let age = now.getFullYear() - birthYear;
    const hasHadBirthdayThisYear =
        now.getMonth() > birthMonthIndex ||
        (now.getMonth() === birthMonthIndex && now.getDate() >= birthDay);
    if (!hasHadBirthdayThisYear) age -= 1;
    return age;
};

const formatUptime = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

const BannerMeta: React.FC = () => {
    const startedAtRef = useRef<number>(Date.now());
    const [uptimeMs, setUptimeMs] = useState(0);
    const [resolution, setResolution] = useState('—');

    useEffect(() => {
        const updateResolution = () => setResolution(`${window.innerWidth}×${window.innerHeight}`);
        updateResolution();
        window.addEventListener('resize', updateResolution);

        const interval = window.setInterval(() => {
            setUptimeMs(Date.now() - startedAtRef.current);
        }, 1000);

        return () => {
            window.removeEventListener('resize', updateResolution);
            window.clearInterval(interval);
        };
    }, []);

    const labelStyle: React.CSSProperties = { color: '#B08D57' };
    const valueStyle: React.CSSProperties = { color: '#B7B0A2' };

    const rows: Array<[string, string]> = [
        ['Host', 'uday.sh'],
        ['OS', "Uday's blood sweat and tears"],
        ['Framework', 'Astro 4 + React 18'],
        ['UI', 'terminal + library sidebar'],
        ['Content', 'Novel Commentaries'],
        ['Commands', 'help, cd, ls, open, cat, search, tree, home, back, clear, summary'],
        ['Version', '0.0.1'],
        ['Resolution', resolution],
        ['Uptime', formatUptime(uptimeMs)],
        ['Instructions', 'ponder, question, and think like your life depends on it'],
    ];

    return (
        <div
            style={{
                marginTop: '0.9rem',
                fontFamily: 'monospace',
                fontSize: '12px',
                display: 'grid',
                gridTemplateColumns: '110px auto',
                columnGap: '12px',
                rowGap: '2px',
            }}
        >
            {rows.flatMap(([label, value]) => [
                <span key={`${label}-label`} style={labelStyle}>
                    {label}:
                </span>,
                <span key={`${label}-value`} style={valueStyle}>
                    {value}
                </span>,
            ])}
        </div>
    );
};

const defaultBanner: HistoryItem = {
    id: 'init-banner',
    type: 'banner',
	    content: (
	        <div
	            style={{
	                paddingBottom: '0',
	                display: 'grid',
	                gridTemplateColumns: 'auto 1fr',
	                alignItems: 'flex-start',
	                columnGap: '2rem',
	                width: '100%',
	            }}
	        >
            {/* Left: The Thinker Icon */}
	            <pre
	                style={{
	                    margin: 0,
	                    fontWeight: 'bold',
	                    color: '#B08D57',
	                    lineHeight: 0.8,
	                    fontFamily: 'monospace',
	                    fontSize: '7.8px',
	                    overflowX: 'visible',
	                    display: 'inline-block',
	                    marginLeft: '0.75rem',
	                    transform: 'scaleX(0.8)',
	                    transformOrigin: 'left top',
	                }}
	            >
                {`
                                                                                                      ]%#%@@#@@>          
                                                                                                   [{](<<>^***^({%.       
                                                                                                 %{(<*+==--:.:~=*^<}      
                                                                                               -#[)>++=~-..  .. .:~^<(~    
                                                                                             @}))>^+=~:            ~^<(*   
                                                                                          .%})>^=:.                :=-*[*  
                                                                                         #@<+:..                  .-: .^#~ 
                                                                      .+><*+         ~{}(<+-:.           ...      .. ::-(@ 
                                                                 =#{}[]])<>>><<>({}[()^*~:.      :.     -~^**        :--+))
                                                             :[[(>>^**+*^<))){@%%@%})<+==++~  ..       --= :^       .--~*<+
                                                          })>*+~~++=)%{])<(%{(<>^<)][}}])))>~~.       :=+:   }:..::-~(<](  
                                                       =[<*=~---=*{#[[[][}}]<^^*+++^>)((()(}]= ....  . .:      . .  .-^}   
                                                     *})^=-:..-]%#}}[}[]][](<^++~--~~=+*><(#* .-~*.             ->]>~~>    
                                                   :})^+~-:.+#}()<^^^^>)[[(>+=~-:::::-==++^(^==>*~--:    .. ...:*%-.+      
                                                  []>*~---[{])^++===*^(](^+~~:::::::~=+**^^>}<[>*~=+^~..:-~-=~^{#>-~.      
                                                 {)*=::~%])>*=--::-=*))>+~-::.... .:-:-~+^><>[{>]{](<(==+*+^)^)=.=-~       
                                                =(+-:~}]<^*+~::..:~+^<^=:......      .....:=^<]#^+<#)+=--.:~+=:*><-        
                                               {}>+^{]<^^++~--:::-=*>*=.      .             .:=>}}.-**^<^~-.  :(           
                                              %]^>{]<^^**++==---~~=*==-:                      .:*[%.<~--^)]}). ^(          
                                            +[<*%[(>^^*^^*==~--~=-~--::.                        :={) :^   .(^=:~}~         
                                           +]>^#((<<>^^^**=~-:.:-:::..               ..          -^}   >=    .-*[}         
                                          .]<<}[[[(<^>^=+=-:...::::.             .::::      .    ~*[     )~ .:-*}[*        
                                          [>]#{{])^*+====--..  ....           .:-~++-      .:  .-=<{      }<*^)(<]{        
                                          [>]#{{])^*+====--..  ....           .:-~++-      .:  .-=<{      }<*^)(<]{        
                                         ]^[#{[)^*+=====--.   . .           .-~+*>>^=~.   .::--~*<[%      ](<]**+)<        
                                        ]*#}[(>>*++=~-~-..                 ..~=+<))>(*-..:::-~=*(}[}     <(=-:.~*(.        
                                       (*{[()<**^+~~::.                    :-~*<]#]<[>=-:--:-+^[]((+    <)~.   .+(         
                                      {)@]))<^*^++=-.             ... ..::~=*<[#<^^)})*~----+>[])[<    [>=..   -^          
                                     ^]{]))<>^+++~-.               .:-~+*^)]%#<><)]%%]>=~+**<[%]#@.  -#)+:    =^+          
                                     #[[)<<)^+~--::..           .::~++^<)]{}@#{#[][(%#{])<)]](>(%}{ [}<~.    -*)           
                                    .}#)<^<<^=-:..  ...       .-++^>^>><)}    (~::.*{(#}}})=~~+>[##@(^=-. . :-^            
                                    (#(>^>>>*+::      .:--:----~~~+^><]#(      >+:..}}(<]^~~-==+>[@{^~: .~:.:=(            
                                    %%)>>><<*=~:       .:-======++^)(%@         :^-  [}(<<+~===~+*{)-.  :++::>             
                                   -#[)<())>*=::         ::~=^>)]}%{}             <~= ][])^+=**=~~^)..:.-^*-^              
                                   (#[(]](<*=~:        ..--~=>[%{]#                }^*-#}<^+*)^+-:+[~.-~=)*+<              
                                   {}}[](<^=-:         ..-~~<%#%#                   ((>)%(^*++:=-.-<^..=<]>)               
                                  =(#}[(<^+~-           .:-+^%@^                      {)#}<*=:.~:..~*-.=})]                
                                  ]<#])<^*=~.           -.:-=)#@                       ]%#>^~::~~.:-+--)}{                 
                                 ^))}<<^*++~.   .==++*^>)]}[^*>{{                       (%(>*~~==~~+**(%#=<+               
                                 ]^<[<^*=*=-:::.:::::::-~*>({@@[%@@@@@@@@@@@@@#}{#%#]*  >#@]](><<<><]@}(.-~^]              
                                 ]^>%(^*=+=--:::::...   ..-+*<(()<<>>><<<)<<<<<<(([[[[]}#%#}}{{{{[{%)([+: .~*].            
                                 #](@])++~~::... :..        :-----.:.:--~==~~~~-~~=---~~~~=+*^<<[##=*^[}}<-:-=(            
                                 }{{@}<^*~-::.    ....                 .:---:..  .            .~=+^)]@<=^((^**^[           
                                 []{%})^*+~:.        ...              .:::-.                     .:-=^({@}^*++^<{.         
                                 [<{{()^**=-:        ..--::                                          .~+<(%@%**)[<         
                                 [^%]<^**==--.          :--::...                                       :-=+<}@#<(%         
                                 ()[})^*===~::.             .:...                                        . .:~<}@#%         
                                 {<[[<^==~~::                  .:::...               ....                    .-+)}%>        
                                 }>{]<*+~~-:.                    :-~-::::-~---~====+++=======~~--:.:       . ..--=<}        
                                 {^({)^+-~-::                       -~===++*^^^>^*=~~~~~~~~-::      ...    .:.:..~*}~       
                                 {>=#]<*=~--::...    ......            -:::-::::.::-:-::-.           ~:     :-=-~*<}]       
                           ~     ~]= }{)^*+=+=~~~~--::.:--~-:.             .....::::---::::.. ..     :~-::.:-=+*^>]<~       
                          @]<}%@@@@@@@())>^^<<<^^^><<]{(>^^^<<^=~--........-=~~~~~=+***+**+*++-        :~~+~:~=><[<         
                         @*...::*+=*<))<**==-.     .         :=>)()))<><))([](][}}}}{{][#])^>^~.        .....:=(#*          
                        ((-:.:::~~===                .          :....=>){{(%(=(^>(<~.   ](<^~.         ..   :=)%            
                       :#=  :::~:==-                                ...:-=)@>^[)(^~.  *[<*~:         :.....~*)[             
                       ()- ....:-~:.                   .           ::-++^<{#+[>)^-  -%(+~          .:..::-+^[               
                       @+  ....:-:.                              :~~~+^**<%#)*)*   %[>~.          :~~~::-~=<)                
                       @      .::                       ..      :-~*^^***<@{*)*. =[^^+-.  .     :~+---==)-                  
                       (.::-  ..                   ..--:..     :~*++^***^^@[+=-.*]+=::.--.    :~+*:.-+(=                    
                       ^ ....:.                        :    :..~=++*^***)(%--:  ]<~::.      :=+*~--~*(                      
                      ~+     .-.      .      .      -=^^~     .~++^^>^<><]+:.  *(]*-~     :-=+~::-~^)                       
                      @-     ..       ..:    .... :-+=-.:.    =+*^^<)>>>)(:.  :(*<*~  :::-~---:-~*)                         
                      {.             . .:  .  .=+=[}<: :     -><^<<)<^^>(-:  .)*^^:  -   .:::::=<:                          
                     =(             :-.:..:            :-.  .*<><)(<<>^^^:  .<+-<-  :   .-:-~=>*                            
                     ([+ ..         ~~:...                . +<<<)((<>><<:   <=:*+..:. .:-~==*[                              
                     ]%#   .     .:.  :-  .  .:            .<)<<(](<))(+:  ]-:=^:.-..:-=+*>)                                
                    ([@%+..           ....:::.             *))<)]}((((<-  ]*.~^-.~..~=*^<<                                  
                   (@@{]<>+:..          :-::::.            <)))[{}()]]:. (*--*-.-  -+*)^                                    
                  +>@@]*=~*^-           --.:..:            ((]}{}](((*:*]*.-=:..  ~^))                                      
                  <)#@}+^^^+.      ..........=            +[}}}}]<<)[+]^: .--.  .^(]                                        
                 .)(#@<<*^*-.     ..   .:..:=:           .<#[[[(>><#(=   .-::. *[[~                                           
                  {[@@*<^^+~    ......    ..             ~)}(((<=[[:    ==-.  (<]                                           
                  %%@@+>***-     .::::.                  ^{]<^>>}+     --:  :*=<*                                           
                  {@@@>^^^+.          .~-                #[*+=+=+-    .:=-=: :=(-                                           
                  >@#@)>>^~                              (>[^--=+^<=         .+)-                                           
                   @{@@)*>=                               +>}()<^()(^-.       =<%^                                          
                   @@@@]>**.    .                           ^((((]}#@[<*:    .>){)(                                        
                  #]@@@@(=*-      .:           ...::.        >><<)<)((][@)*-:  ~(]]=(                                       
                 #]]#@@#[)+=.     ...      -+~:..:...... .       -====*+^>##<> .=[{) .==.                                   
                <#)}@@#@<>><:    -:.   . )*...... .......:         .-=~=++*(])+. ^[{%*  >                                   
               -{<}(@@@(<]<+..-~~~=+=+*<: .:::::........-:.       ..:-~~++*^)<^^. +=]{^}                                    
              ]]]{[#@@@+)*~-:--=++++*^=-.          ...:=~~~~:.:....: :~=***^><)(][}#%@<                              
@@#{}]])<>^^*++=~~~--:-:....                                    . .::::~~~~=++**^><)(][}#%@<                              
@@%{][()<>>>+++~~~~~::-:....                                   .  .::::~~~~=+++*^><))]]}{%@<`}
            </pre>

	            {/* Right: The Text ASCII */}
		            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifySelf: 'center', width: 'max-content', marginTop: '1rem', transform: 'translateX(-4rem)' }}>
		                <div style={{ color: '#B7B0A2', fontSize: '11px', marginTop: '0.35rem', marginBottom: '0.15rem', fontFamily: 'monospace', textAlign: 'right' }}>
		                    since 2025 · current age {getAge(new Date())}
		                </div>
                <div style={{ display: 'inline-block' }}>
                <pre style={{ margin: 0, fontWeight: 'bold', color: '#B08D57', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.0, whiteSpace: 'pre' }}>
                    {`
 ___  ___  ________  ________      ___    ___ _________   ___    ___ _________   
|\\  \\|\\  \\|\\   ___ \\|\\   __  \\    |\\  \\  /  /|\\___   ___\\|\\  \\  /  /|\\___   ___\\ 
\\ \\  \\\\\\  \\ \\  \\_|\\ \\ \\  \\|\\  \\   \\ \\  \\/  / ||___ \\  \\_|\\ \\  \\/  / ||___ \\  \\_| 
 \\ \\  \\\\\\  \\ \\  \\ \\\\ \\ \\   __  \\   \\ \\    / /     \\ \\  \\  \\ \\    / /     \\ \\  \\  
  \\ \\  \\\\\\  \\ \\  \\_\\\\ \\ \\  \\ \\  \\   \\/  /  /__     \\ \\  \\  /     \\/       \\ \\  \\  
   \\ \\_______\\ \\_______\\ \\__\\ \\__\\__/  / /|\\__\\     \\ \\__\\/  /\\   \\        \\ \\__\\
    \\|_______|\\|_______|\\|__|\\|__|\___/ / \\ |__|      \\|__/__/ /\\ __\\        \\|__|
                                 \\|___|/                 |__|/ \\|__|             
`}
                </pre>
                <div style={{ marginTop: '0.5rem', color: '#B7B0A2', fontStyle: 'italic', fontSize: '11px' }}>
                    a collection of a teenagers entirely unrequired remarks
                </div>
                </div>
                <BannerMeta />
            </div>
        </div>
    )
};

const getInitialState = (props: ShellProps): ShellState => ({
    history: props.initialHistory || [defaultBanner],
    commandHistory: [],
    cwds: [props.initialCwd || '/'],
    currentCwd: props.initialCwd || '/',
});

function shellReducer(state: ShellState, action: Action): ShellState {
    switch (action.type) {
        case 'ADD_HISTORY':
            return { ...state, history: [...state.history, action.item] };
        case 'CLEAR_HISTORY':
            return {
                ...state,
                history: (() => {
                    const banners = state.history.filter((item) => item.type === 'banner');
                    return banners.length > 0 ? banners : [defaultBanner];
                })(),
            };
        case 'ADD_COMMAND':
            return { ...state, commandHistory: [...state.commandHistory, action.cmd] };
        case 'SET_CWD':
            return { ...state, currentCwd: action.path, cwds: [...state.cwds, action.path] };
        case 'GO_BACK':
            if (state.cwds.length <= 1) return state;
            const newCwds = state.cwds.slice(0, -1);
            return { ...state, cwds: newCwds, currentCwd: newCwds[newCwds.length - 1] };
        case 'REPLACE_STATE':
            return action.newState;
        default:
            return state;
    }
}

// Helper: Resolve Path
const resolvePath = (root: DirectoryNode, current: string, target: string): string | null => {
    if (target === '/' || target === '~') return '/';

    let parts = target.startsWith('/')
        ? target.split('/').filter(Boolean)
        : [...current.split('/').filter(Boolean), ...target.split('/').filter(Boolean)];

    const stack: string[] = [];
    for (const p of parts) {
        if (p === '.') continue;
        if (p === '..') {
            stack.pop();
        } else {
            stack.push(p);
        }
    }

    let cursor: any = root;
    for (const p of stack) {
        if (cursor.type !== 'dir' || !cursor.children[p]) return null;
        cursor = cursor.children[p];
    }

    return '/' + stack.join('/');
};

const getNodeAtPath = (root: DirectoryNode, path: string): FSNode | null => {
    if (path === '/' || path === '') return root;
    const parts = path.split('/').filter(Boolean);
    let cursor: FSNode = root;
    for (const part of parts) {
        if (cursor.type !== 'dir') return null;
        const nextNode: FSNode | undefined = cursor.children[part];
        if (!nextNode) return null;
        cursor = nextNode;
    }
    return cursor;
};

const getSortedChildren = (dir: DirectoryNode): Array<[string, FSNode]> => {
    return Object.entries(dir.children).sort(([nameA, nodeA], [nameB, nodeB]) => {
        if (nodeA.type !== nodeB.type) return nodeA.type === 'dir' ? -1 : 1;
        return nameA.localeCompare(nameB);
    });
};

const buildPathAutocompleteSuggestions = (
    root: DirectoryNode,
    cwd: string,
    token: string,
    mode: PathCompletionMode
): AutocompleteSuggestion[] => {
    const lastSlashIndex = token.lastIndexOf('/');
    const prefixForRebuild = lastSlashIndex === -1 ? '' : token.slice(0, lastSlashIndex + 1);
    const dirToken = lastSlashIndex === -1 ? '' : token.slice(0, lastSlashIndex);
    const basePrefix = lastSlashIndex === -1 ? token : token.slice(lastSlashIndex + 1);
    const basePrefixLower = basePrefix.toLowerCase();

    const dirArg = dirToken === '' ? (token.startsWith('/') ? '/' : '.') : dirToken;
    const resolvedDirPath = resolvePath(root, cwd, dirArg);
    if (!resolvedDirPath) return [];

    const dirNode = getNodeAtPath(root, resolvedDirPath);
    if (!dirNode || dirNode.type !== 'dir') return [];

    const results: AutocompleteSuggestion[] = [];
    for (const [childName, childNode] of getSortedChildren(dirNode)) {
        if (basePrefixLower && !childName.toLowerCase().startsWith(basePrefixLower)) continue;
        if (mode === 'dir' && childNode.type !== 'dir') continue;
        if (mode === 'file' && childNode.type !== 'file') continue;

        const suffix = childNode.type === 'dir' ? '/' : '';
        const insertText = `${prefixForRebuild}${childName}${suffix}`;
        const title = childNode.meta?.title;
        const label = title && title !== childName ? `${insertText} — ${title}` : insertText;
        results.push({
            kind: childNode.type === 'dir' ? 'dir' : 'file',
            insertText,
            label,
        });
    }

    return results;
};

const buildPathFuzzySuggestions = (
    root: DirectoryNode,
    cwd: string,
    token: string,
    mode: PathCompletionMode
): AutocompleteSuggestion[] => {
    const lastSlashIndex = token.lastIndexOf('/');
    const prefixForRebuild = lastSlashIndex === -1 ? '' : token.slice(0, lastSlashIndex + 1);
    const dirToken = lastSlashIndex === -1 ? '' : token.slice(0, lastSlashIndex);
    const baseQuery = lastSlashIndex === -1 ? token : token.slice(lastSlashIndex + 1);

    const dirArg = dirToken === '' ? (token.startsWith('/') ? '/' : '.') : dirToken;
    const resolvedDirPath = resolvePath(root, cwd, dirArg);
    if (!resolvedDirPath) return [];

    const dirNode = getNodeAtPath(root, resolvedDirPath);
    if (!dirNode || dirNode.type !== 'dir') return [];

    const candidates = getSortedChildren(dirNode)
        .filter(([, childNode]) => {
            if (mode === 'dir') return childNode.type === 'dir';
            if (mode === 'file') return childNode.type === 'file';
            return true;
        })
        .map(([name]) => name);

    const rankedNames = baseQuery.trim().length === 0 ? candidates.slice(0, 6) : rankCandidates(baseQuery, candidates, 6);

    const suggestions: AutocompleteSuggestion[] = [];
    for (const name of rankedNames) {
        const childNode = dirNode.children[name];
        if (!childNode) continue;
        const suffix = childNode.type === 'dir' ? '/' : '';
        const insertText = `${prefixForRebuild}${name}${suffix}`;
        const title = childNode.meta?.title;
        const label = title && title !== name ? `${insertText} — ${title}` : insertText;
        suggestions.push({
            kind: childNode.type === 'dir' ? 'dir' : 'file',
            insertText,
            label,
        });
    }

    return suggestions;
};

const collectRelativePaths = (
    dir: DirectoryNode,
    options: { maxDepth: number; maxItems: number; excludeNames?: Set<string> }
): { files: string[]; dirs: string[] } => {
    const files: string[] = [];
    const dirs: string[] = [];
    const exclude = options.excludeNames ?? new Set<string>();

    const walk = (node: DirectoryNode, prefix: string, depth: number) => {
        if (depth > options.maxDepth) return;
        if (files.length + dirs.length >= options.maxItems) return;

        for (const [name, child] of getSortedChildren(node)) {
            if (exclude.has(name)) continue;

            if (child.type === 'dir') {
                const dirPath = `${prefix}${name}`;
                dirs.push(dirPath);
                if (depth < options.maxDepth) {
                    walk(child, `${dirPath}/`, depth + 1);
                }
            } else {
                files.push(`${prefix}${name}`);
            }

            if (files.length + dirs.length >= options.maxItems) return;
        }
    };

    walk(dir, '', 0);
    return { files, dirs };
};

const collectSearchTerms = (root: DirectoryNode, maxTerms: number): string[] => {
    const terms = new Set<string>();

    const addTerm = (value: string | undefined) => {
        if (!value) return;
        const term = value.trim();
        if (term.length < 3) return;
        if (/\s/.test(term)) return;
        terms.add(term.toLowerCase());
    };

    const walk = (node: FSNode) => {
        if (node.type === 'file') {
            addTerm(node.name);
            node.meta?.tags?.forEach(addTerm);
            const title = node.meta?.title;
            if (title) addTerm(title.split(/\s+/)[0]);
            return;
        }

        if (node.name) addTerm(node.name);
        node.meta?.tags?.forEach(addTerm);
        const title = node.meta?.title;
        if (title) addTerm(title.split(/\s+/)[0]);

        for (const child of Object.values(node.children)) {
            walk(child);
            if (terms.size >= maxTerms) return;
        }
    };

    walk(root);
    return Array.from(terms);
};

const buildTryChips = (root: DirectoryNode, cwd: string, chipCount: number): TryChip[] => {
    const chips: TryChip[] = [];
    const used = new Set<string>();
    const pushUnique = (chip: TryChip | null) => {
        if (!chip) return;
        if (used.has(chip.command)) return;
        used.add(chip.command);
        chips.push(chip);
    };

    const cwdNode = getNodeAtPath(root, cwd);
    const cwdDir = cwdNode && cwdNode.type === 'dir' ? cwdNode : root;

    const { files, dirs } = collectRelativePaths(cwdDir, {
        maxDepth: 3,
        maxItems: 80,
        excludeNames: new Set(['about']),
    });

    const openArg = pickRandomItem(files) ?? pickRandomItem(dirs);
    if (openArg) pushUnique({ command: `open ${openArg}`, label: `open ${openArg}` });

    const searchTerms = collectSearchTerms(root, 80);
    const term = pickRandomItem(searchTerms);
    if (term) pushUnique({ command: `search ${term}`, label: `search ${term}` });

    const basePool: TryChip[] = [
        { command: 'ls', label: 'ls' },
        { command: 'tree', label: 'tree' },
        { command: 'summary', label: 'summary' },
        { command: 'help', label: 'help' },
        { command: 'home', label: 'home' },
    ];

    let safety = 0;
    while (chips.length < chipCount && safety < 50) {
        safety += 1;
        pushUnique(pickRandomItem(basePool));
    }

    return chips.slice(0, chipCount);
};

const buildTreeText = (node: FSNode, displayName: string, maxDepth: number): string => {
    const lines: string[] = [];

    const walk = (current: FSNode, name: string, prefix: string, isLast: boolean, depth: number) => {
        const connector = depth === 0 ? '' : isLast ? '└── ' : '├── ';
        const label = current.type === 'dir' ? (name === '/' ? '/' : `${name}/`) : name;
        const metaTitle = current.meta?.title;
        const title = metaTitle && metaTitle !== name ? ` — ${metaTitle}` : '';
        lines.push(prefix + connector + label + title);

        if (current.type !== 'dir') return;
        if (depth >= maxDepth) return;

        const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');
        const entries = getSortedChildren(current);
        for (let i = 0; i < entries.length; i++) {
            const [childName, childNode] = entries[i];
            walk(childNode, childName, childPrefix, i === entries.length - 1, depth + 1);
        }
    };

    walk(node, displayName, '', true, 0);
    return lines.join('\n');
};

const parseDepthArg = (value: string | undefined): number | null => {
    if (!value) return null;
    const depth = Number(value);
    if (!Number.isFinite(depth)) return null;
    return Math.max(0, Math.floor(depth));
};

export const Shell: React.FC<ShellProps> = (props) => {
    const [state, dispatch] = useReducer(shellReducer, props, getInitialState);
    const [input, setInput] = useState('');
    const [historyPointer, setHistoryPointer] = useState<number | null>(null);
    const [tryChips, setTryChips] = useState<TryChip[]>([]);
    const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
    const [hasUsedOpen, setHasUsedOpen] = useState(false);
    const [helpWizardStep, setHelpWizardStep] = useState<'none' | 'start' | 'experience'>('none');
    const helpWizardSeenRef = useRef(false);

    const bottomRef = useRef<HTMLDivElement>(null);
    const promptRef = useRef<HTMLInputElement>(null);
    const lastOpenedFilePathRef = useRef<string | null>(null);

    // Sync props if deep link changes (though usually page reload handles this, but for SPA moves)
    useEffect(() => {
        if (props.initialCwd && props.initialCwd !== state.currentCwd) {
            // Logic to merge history? Or just ignore? 
            // For now, let's assume page reload on navigation so props only matter on mount.
        }
    }, [props.initialCwd]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [state.history]);

    useEffect(() => {
        if (!isCheatSheetOpen) return;

        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setIsCheatSheetOpen(false);
                window.requestAnimationFrame(() => promptRef.current?.focus());
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isCheatSheetOpen]);

    useEffect(() => {
        if (!props.fs || helpWizardStep !== 'none') {
            setTryChips([]);
            return;
        }

        if (hasUsedOpen) {
            setTryChips([]);
            return;
        }

        setTryChips(buildTryChips(props.fs.root, state.currentCwd, 3));
    }, [hasUsedOpen, helpWizardStep, props.fs, state.commandHistory.length, state.currentCwd]);

    const autocomplete = useMemo(() => {
        if (helpWizardStep !== 'none') {
            return { suggestions: [] as AutocompleteSuggestion[], ghostSuffix: '', beforeToken: '', quoteChar: null as string | null, tokenPrefix: '', mode: 'none' as 'none' | 'command' | 'path' };
        }

        const trimmedStart = input.trimStart();
        if (trimmedStart.length === 0) {
            return { suggestions: [] as AutocompleteSuggestion[], ghostSuffix: '', beforeToken: '', quoteChar: null as string | null, tokenPrefix: '', mode: 'none' as 'none' | 'command' | 'path' };
        }

        const tokenMatch = input.match(/(\S*)$/);
        const rawToken = tokenMatch ? tokenMatch[1] : '';
        const beforeToken = input.slice(0, input.length - rawToken.length);

        const quoteChar = rawToken.startsWith('"') || rawToken.startsWith("'") ? rawToken[0] : null;
        const tokenPrefix = quoteChar ? rawToken.slice(1) : rawToken;
        const tokenPrefixLower = tokenPrefix.toLowerCase();

        const isCommandPosition = !/\s/.test(trimmedStart);
        if (isCommandPosition) {
            const suggestions = AUTOCOMPLETE_COMMANDS
                .map((c) => c.name)
                .filter((name) => name.startsWith(tokenPrefixLower))
                .map((name) => ({ kind: 'command' as const, insertText: name, label: name }));
            const ghostSuffix = suggestions[0] ? suggestions[0].insertText.slice(tokenPrefix.length) : '';
            return { suggestions, ghostSuffix, beforeToken, quoteChar, tokenPrefix, mode: 'command' as const };
        }

        const rawCmdToken = trimmedStart.split(/\s+/)[0]?.toLowerCase() ?? '';
        const commandName = AUTOCOMPLETE_ALIASES[rawCmdToken] || rawCmdToken;

        const pathMode: PathCompletionMode | null =
            commandName === 'cd' ? 'dir'
                : commandName === 'cat' ? 'file'
                    : commandName === 'open' ? 'both'
                        : commandName === 'tree' ? 'both'
                            : null;

        if (!pathMode || !props.fs) {
            return { suggestions: [] as AutocompleteSuggestion[], ghostSuffix: '', beforeToken, quoteChar, tokenPrefix, mode: 'none' as const };
        }

        const suggestions = buildPathAutocompleteSuggestions(props.fs.root, state.currentCwd, tokenPrefix, pathMode);
        const ghostSuffix = suggestions[0] ? suggestions[0].insertText.slice(tokenPrefix.length) : '';
        return { suggestions, ghostSuffix, beforeToken, quoteChar, tokenPrefix, mode: 'path' as const };
    }, [helpWizardStep, input, props.fs, state.currentCwd]);

    const execute = (raw: string) => {
        if (!raw.trim()) return;

        dispatch({
            type: 'ADD_HISTORY',
            item: {
                id: Date.now().toString() + '-cmd',
                type: 'command',
                content: raw,
                path: state.currentCwd
            }
        });

        dispatch({ type: 'ADD_COMMAND', cmd: raw });
        setHistoryPointer(null);

        const parsed = parseCommand(raw);

        if (parsed?.error) {
            dispatch({ type: 'ADD_HISTORY', item: { id: Date.now() + '-err', type: 'error', content: parsed.error } });
            return;
        }

        if (!parsed) return;
        const { commandName, args } = parsed;

        const nowId = (suffix: string) => `${Date.now()}-${suffix}`;
        const buildErrorContent = (message: string, fixes: FixSuggestion[]) => {
            if (fixes.length === 0) return <div style={{ whiteSpace: 'pre-wrap' }}>{message}</div>;

            return (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                    <div>{message}</div>
                    <div
                        style={{
                            marginTop: '0.45rem',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.4rem',
                            alignItems: 'center',
                        }}
                    >
                        <span style={{ color: '#B7B0A2', opacity: 0.75 }}>Did you mean:</span>
                        {fixes.slice(0, 4).map((fix) => (
                            <span
                                key={fix.command}
                                style={{
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    color: '#E6E0D2',
                                    opacity: 0.75,
                                    whiteSpace: 'pre',
                                    userSelect: 'text',
                                }}
                            >
                                {fix.label}
                            </span>
                        ))}
                        <span style={{ color: '#B7B0A2', opacity: 0.55, marginLeft: '0.25rem' }}>Type one to run</span>
                    </div>
                </div>
            );
        };

        const addError = (message: string, fixes: FixSuggestion[] = []) => {
            dispatch({ type: 'ADD_HISTORY', item: { id: nowId('err'), type: 'error', content: buildErrorContent(message, fixes) } });
        };
        const addOutput = (content: React.ReactNode, suffix: string = 'out') => {
            dispatch({ type: 'ADD_HISTORY', item: { id: nowId(suffix), type: 'output', content } });
        };

        if (helpWizardStep !== 'none') {
            const answer = raw.trim().toLowerCase();
            const isYes = answer === 'y' || answer === 'yes';
            const isNo = answer === 'n' || answer === 'no';

            if (!isYes && !isNo) {
                addOutput(
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                        <div style={{ opacity: 0.9 }}>Please answer:</div>
                        <div style={{ marginTop: '0.35rem', color: '#B08D57' }}>Yes/No</div>
                    </div>,
                    'help-wizard'
                );
                return;
            }

            if (helpWizardStep === 'start') {
                if (isNo) {
                    addOutput(
                        <div style={{ whiteSpace: 'pre-wrap' }}>I understand. Take your time!</div>,
                        'help-wizard'
                    );
                    setHelpWizardStep('none');
                    return;
                }

                helpWizardSeenRef.current = true;
                addOutput(
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                        <div>Ah! Well in that case, do you have any experience in the art of terminal navigation?</div>
                        <div style={{ marginTop: '0.5rem', color: '#B08D57' }}>Yes/No</div>
                    </div>,
                    'help-wizard'
                );
                setHelpWizardStep('experience');
                return;
            }

            if (helpWizardStep === 'experience') {
                if (isYes) {
                    addOutput(
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                            {`Splendid! You may navigate my garden with the same vigor you may rummage through the depths of your own shell!

You may also explore commands such as:
- search   (look for specific books/texts)
- open <chapter name>   (to read one of my pieces)

May this sanctuary provide to you the same peace it brought to me!`}
                        </div>,
                        'help-wizard'
                    );
                    setHelpWizardStep('none');
                    return;
                }

                addOutput(
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                        {`No worries — we’ll start simple:

- ls                 list what’s here
- cd <dir>           move around
- home               return to the beginning
- back               go to the previous place
- open <file|dir>    open a chapter or step into a folder
- cat <file>         read a file without changing location
- search <term>      find chapters by name/tags
- tree [-L depth]    see the structure
- clear              clear the screen
- summary            quick start sheet`}
                    </div>,
                    'help-wizard'
                );
                setHelpWizardStep('none');
                return;
            }
        }

        if (!props.fs) {
            addError('FileSystem not loaded.');
            return;
        }

        const fs = props.fs;
        const pushUrl = (path: string) => {
            const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
            window.history.pushState(null, '', normalized);
        };

        const runHome = () => {
            const homePath = '/';
            dispatch({ type: 'SET_CWD', path: homePath });
            pushUrl(homePath);
        };

        const runTree = () => {
            let targetPathArg: string | undefined;
            let maxDepth: number = 4;
            let depthWasExplicit = false;

            if (args[0] === '-L' || args[0] === '--depth') {
                depthWasExplicit = true;
                const parsedDepth = parseDepthArg(args[1]);
                if (parsedDepth === null) {
                    addError('Usage: tree [-L depth] [path]', [
                        { command: 'tree', label: 'tree' },
                        { command: 'tree -L 4', label: 'tree -L 4' },
                    ]);
                    return;
                }
                maxDepth = parsedDepth;
                targetPathArg = args[2];
            } else if (args.length === 1) {
                const parsedDepth = parseDepthArg(args[0]);
                if (parsedDepth !== null) {
                    depthWasExplicit = true;
                    maxDepth = parsedDepth;
                }
                else targetPathArg = args[0];
            } else if (args.length >= 2) {
                const parsedDepthFirst = parseDepthArg(args[0]);
                if (parsedDepthFirst !== null) {
                    depthWasExplicit = true;
                    maxDepth = parsedDepthFirst;
                    targetPathArg = args[1];
                } else {
                    targetPathArg = args[0];
                    const parsedDepthSecond = parseDepthArg(args[1]);
                    if (parsedDepthSecond !== null) {
                        depthWasExplicit = true;
                        maxDepth = parsedDepthSecond;
                    }
                }
            }

            const resolvedPath = targetPathArg
                ? resolvePath(fs.root, state.currentCwd, targetPathArg)
                : state.currentCwd;

            if (!resolvedPath) {
                const basePrefix = depthWasExplicit ? `tree -L ${maxDepth} ` : 'tree ';
                const fixes = targetPathArg
                    ? buildPathFuzzySuggestions(fs.root, state.currentCwd, targetPathArg, 'both').map((s) => ({
                        command: `${basePrefix}${s.insertText}`,
                        label: `${basePrefix}${s.label}`,
                    }))
                    : [];
                addError(
                    `tree: no such file or directory: ${targetPathArg}`,
                    fixes.length > 0 ? fixes : [{ command: 'tree', label: 'tree' }, { command: 'ls', label: 'ls' }]
                );
                return;
            }

            const node = getNodeAtPath(fs.root, resolvedPath);
            if (!node) {
                const basePrefix = depthWasExplicit ? `tree -L ${maxDepth} ` : 'tree ';
                const fixes = targetPathArg
                    ? buildPathFuzzySuggestions(fs.root, state.currentCwd, targetPathArg, 'both').map((s) => ({
                        command: `${basePrefix}${s.insertText}`,
                        label: `${basePrefix}${s.label}`,
                    }))
                    : [];
                addError(
                    `tree: no such file or directory: ${targetPathArg ?? resolvedPath}`,
                    fixes.length > 0 ? fixes : [{ command: 'tree', label: 'tree' }, { command: 'ls', label: 'ls' }]
                );
                return;
            }

            const displayName = resolvedPath === '/' ? '/' : resolvedPath.split('/').filter(Boolean).pop() ?? resolvedPath;
            const treeText = buildTreeText(node, displayName, maxDepth);
            addOutput(<div style={{ whiteSpace: 'pre', fontFamily: 'monospace' }}>{treeText}</div>, 'tree');
        };

        const runSummary = () => {
            const content = `Quick start:
- ls
- cd <dir> | cd .. | cd /
- home
- cat <file>
- open <file|dir>
- search <term>
- tree [-L depth] [path]
- clear

Tip: Use ↑/↓ to cycle command history.`;

            addOutput(<div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>, 'summary');
        };

        const highlightSidebarSelection = (directoryPath: string, filePath?: string | null) => {
            window.dispatchEvent(
                new CustomEvent('udaysh:sidebar:highlight', {
                    detail: { directoryPath, filePath: filePath ?? undefined },
                })
            );
        };

        const getParentDirPath = (absolutePath: string): string => {
            if (absolutePath === '/') return '/';
            const parts = absolutePath.split('/').filter(Boolean);
            parts.pop();
            return parts.length === 0 ? '/' : `/${parts.join('/')}`;
        };

        const runOpen = () => {
            const target = args[0];
            if (!target) {
                addError('Usage: open <path>', [
                    { command: 'open ', label: 'open <path>' },
                    { command: 'ls', label: 'ls' },
                    { command: 'tree', label: 'tree' },
                ]);
                return;
            }

            const path = resolvePath(fs.root, state.currentCwd, target);
            if (!path) {
                const fixes = buildPathFuzzySuggestions(fs.root, state.currentCwd, target, 'both').map((s) => ({
                    command: `open ${s.insertText}`,
                    label: `open ${s.label}`,
                }));
                addError(
                    `open: ${target}: No such file or directory`,
                    fixes.length > 0 ? fixes : [{ command: 'ls', label: 'ls' }, { command: 'tree', label: 'tree' }]
                );
                return;
            }

            const node = getNodeAtPath(fs.root, path);
            if (!node) {
                const fixes = buildPathFuzzySuggestions(fs.root, state.currentCwd, target, 'both').map((s) => ({
                    command: `open ${s.insertText}`,
                    label: `open ${s.label}`,
                }));
                addError(
                    `open: ${target}: No such file or directory`,
                    fixes.length > 0 ? fixes : [{ command: 'ls', label: 'ls' }, { command: 'tree', label: 'tree' }]
                );
                return;
            }

            if (node.type === 'dir') {
                dispatch({ type: 'SET_CWD', path });
                pushUrl(path);
                highlightSidebarSelection(path, lastOpenedFilePathRef.current);
                return;
            }

            const file = node as FileNode;
            const content = file.content || '(Empty file)';
            addOutput(<div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>, 'open');
            pushUrl(`/${file.slug}`);
            lastOpenedFilePathRef.current = path;
            highlightSidebarSelection(getParentDirPath(path), path);
        };

        switch (commandName) {
            case 'help':
                if (!helpWizardSeenRef.current && helpWizardStep === 'none') {
                    setHelpWizardStep('start');
                    addOutput(
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                            <div>Greeting dear traveler! You seem wary from your travels. May I trouble you with a question?</div>
                            <div style={{ marginTop: '0.5rem', color: '#B08D57' }}>Yes/No</div>
                        </div>,
                        'help-wizard'
                    );
                    break;
                }
                dispatch({
                    type: 'ADD_HISTORY',
                    item: {
                        id: Date.now() + '-help',
                        type: 'output',
                        content: (
                            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.5rem' }}>
                                <strong style={{ color: '#B08D57' }}>Navigation</strong> <span>cd, home, back, pwd</span>
                                <strong style={{ color: '#B08D57' }}>Discovery</strong> <span>ls, search, tree</span>
                                <strong style={{ color: '#B08D57' }}>Reading</strong> <span>cat, open</span>
                                <strong style={{ color: '#B08D57' }}>System</strong> <span>clear, help, summary</span>
                            </div>
                        )
                    }
                });
                break;

            case 'clear':
                dispatch({ type: 'CLEAR_HISTORY' });
                break;

            case 'home': {
                runHome();
                break;
            }

            case 'cd': {
                const target = args[0] || '/';
                const newPath = resolvePath(fs.root, state.currentCwd, target);
                if (!newPath) {
                    const fixes = buildPathFuzzySuggestions(fs.root, state.currentCwd, target, 'dir').map((s) => ({
                        command: `cd ${s.insertText}`,
                        label: `cd ${s.label}`,
                    }));
                    addError(
                        `cd: no such file or directory: ${target}`,
                        fixes.length > 0 ? fixes : [{ command: 'ls', label: 'ls' }, { command: 'pwd', label: 'pwd' }]
                    );
                    break;
                }

                const node = getNodeAtPath(fs.root, newPath);
                if (!node) {
                    const fixes = buildPathFuzzySuggestions(fs.root, state.currentCwd, target, 'dir').map((s) => ({
                        command: `cd ${s.insertText}`,
                        label: `cd ${s.label}`,
                    }));
                    addError(
                        `cd: no such file or directory: ${target}`,
                        fixes.length > 0 ? fixes : [{ command: 'ls', label: 'ls' }, { command: 'pwd', label: 'pwd' }]
                    );
                    break;
                }
                if (node.type !== 'dir') {
                    addError(`cd: not a directory: ${target}`, [
                        { command: `open ${target}`, label: `open ${target}` },
                        { command: `cat ${target}`, label: `cat ${target}` },
                    ]);
                    break;
                }

                dispatch({ type: 'SET_CWD', path: newPath });
                pushUrl(newPath);
                break;
            }

            case 'ls': {
                const node = getNodeAtPath(fs.root, state.currentCwd);
                if (!node || node.type !== 'dir') {
                    addError(`ls: not a directory: ${state.currentCwd}`);
                    break;
                }

                const children = getSortedChildren(node).map(([name, child]) => {
                    const isDir = child.type === 'dir';
                    return (
                        <span key={name} style={{ marginRight: '1rem', color: isDir ? '#B08D57' : '#E6E0D2', fontWeight: isDir ? 'bold' : 'normal' }}>
                            {name}{isDir ? '/' : ''}
                        </span>
                    );
                });

                dispatch({
                    type: 'ADD_HISTORY',
                    item: {
                        id: Date.now() + '-ls',
                        type: 'output',
                        content: <div style={{ display: 'flex', flexWrap: 'wrap' }}>{children}</div>
                    }
                });
                break;
            }

            case 'pwd':
                dispatch({
                    type: 'ADD_HISTORY',
                    item: { id: Date.now() + '-pwd', type: 'output', content: state.currentCwd }
                });
                break;

            case 'back': {
                if (state.cwds.length <= 1) {
                    addError('Already at root of session.');
                } else {
                    const nextPath = state.cwds[state.cwds.length - 2] || '/';
                    dispatch({ type: 'GO_BACK' });
                    pushUrl(nextPath);
                }
                break;
            }

            case 'tree': {
                runTree();
                break;
            }

            case 'open': {
                setHasUsedOpen(true);
                runOpen();
                break;
            }

            case 'cat': {
                const target = args[0];
                if (!target) {
                    addError('Usage: cat <filename>', [
                        { command: 'cat ', label: 'cat <filename>' },
                        { command: 'ls', label: 'ls' },
                        { command: 'open ', label: 'open <path>' },
                    ]);
                    return;
                }
                const path = resolvePath(fs.root, state.currentCwd, target);
                if (!path) {
                    const fixes = buildPathFuzzySuggestions(fs.root, state.currentCwd, target, 'file').map((s) => ({
                        command: `cat ${s.insertText}`,
                        label: `cat ${s.label}`,
                    }));
                    addError(
                        `cat: ${target}: No such file`,
                        fixes.length > 0 ? fixes : [{ command: 'ls', label: 'ls' }, { command: 'open ', label: 'open <path>' }]
                    );
                    return;
                }

                const node = getNodeAtPath(fs.root, path);
                if (!node) {
                    const fixes = buildPathFuzzySuggestions(fs.root, state.currentCwd, target, 'file').map((s) => ({
                        command: `cat ${s.insertText}`,
                        label: `cat ${s.label}`,
                    }));
                    addError(
                        `cat: ${target}: No such file`,
                        fixes.length > 0 ? fixes : [{ command: 'ls', label: 'ls' }, { command: 'open ', label: 'open <path>' }]
                    );
                    return;
                }

                if (node.type === 'dir') {
                    addError(`cat: ${target}: Is a directory`, [
                        { command: `ls ${target}`, label: `ls ${target}` },
                        { command: `open ${target}`, label: `open ${target}` },
                    ]);
                    return;
                }

                const file = node as FileNode;
                const content = file.content || '(Empty file)';
                addOutput(<div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>, 'cat');
                break;
            }

            case 'search': {
                const term = args.join(' ').toLowerCase();
                if (!term) {
                    addError('Usage: search <term>', [
                        { command: 'search ', label: 'search <term>' },
                        { command: 'summary', label: 'summary' },
                        { command: 'help', label: 'help' },
                    ]);
                    return;
                }

                const results: any[] = [];
                const walk = (node: DirectoryNode | any, path: string) => {
                    if (node.type === 'file') {
                        if (node.name.toLowerCase().includes(term) ||
                            node.meta.title?.toLowerCase().includes(term) ||
                            node.meta.tags?.some((t: string) => t.includes(term))) {
                            results.push({ path, ...node });
                        }
                    } else if (node.type === 'dir') {
                        if (node.name.toLowerCase().includes(term)) results.push({ path, ...node });
                        for (const childName in node.children) {
                            walk(node.children[childName], path === '/' ? `/${childName}` : `${path}/${childName}`);
                        }
                    }
                };
                walk(fs.root, '/');

                const output = results.length === 0 ? `No results for "${term}"` : results.map(r => (
                    <div key={r.path}>
                        <span style={{ color: '#B7B0A2' }}>[{r.type.toUpperCase()}]</span>
                        <strong style={{ marginLeft: '1ch' }}>{r.meta?.title || r.name}</strong>
                        <span style={{ marginLeft: '1ch', opacity: 0.7 }}>{r.path}</span>
                    </div>
                ));

                dispatch({
                    type: 'ADD_HISTORY',
                    item: {
                        id: Date.now() + '-search',
                        type: 'output',
                        content: <div>{output}</div>
                    }
                });
                break;
            }

            case 'summary': {
                runSummary();
                break;
            }

            default: {
                const rawTrimStart = raw.trimStart();
                const firstSpace = rawTrimStart.indexOf(' ');
                const rest = firstSpace === -1 ? '' : rawTrimStart.slice(firstSpace);
                const candidates = rankCandidates(commandName, AUTOCOMPLETE_COMMANDS.map((c) => c.name), 4);
                const fixes: FixSuggestion[] =
                    candidates.length > 0
                        ? candidates.map((candidate) => {
                            const suggested = `${candidate}${rest}`;
                            return { command: suggested, label: suggested };
                        })
                        : [{ command: 'help', label: 'help' }];

                addError(`Command '${commandName}' not found.`, fixes);
            }
        }
    };

    const handleSubmit = () => {
        if (!input.trim()) return;

        execute(input);
        setInput('');
    };

    const handleTabComplete = () => {
        if (autocomplete.suggestions.length === 0) return;

        const top = autocomplete.suggestions[0];
        const quote = autocomplete.quoteChar ?? '';
        const completedToken = `${quote}${top.insertText}`;
        const shouldAppendSpace =
            autocomplete.mode === 'command' ? true : top.kind !== 'dir' && !top.insertText.endsWith('/');

        setInput(`${autocomplete.beforeToken}${completedToken}${shouldAppendSpace ? ' ' : ''}`);
    };

    const handleHistory = (direction: 'up' | 'down') => {
        const history = state.commandHistory;
        if (history.length === 0) return;

        let newIndex = historyPointer;
        if (direction === 'up') {
            newIndex = newIndex === null ? history.length - 1 : Math.max(0, newIndex - 1);
        } else {
            if (newIndex === null) return;
            newIndex = newIndex + 1;
            if (newIndex >= history.length) newIndex = null;
        }
        setHistoryPointer(newIndex);
        setInput(newIndex !== null ? history[newIndex] : '');
    };

    // Smart autoscroll: track if user is near bottom
    const outputContainerRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);
    const SCROLL_THRESHOLD = 100;

    const handleScroll = () => {
        const el = outputContainerRef.current;
        if (!el) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
    };

    // Auto-scroll when history changes (only if user is near bottom)
    useEffect(() => {
        if (isNearBottomRef.current && outputContainerRef.current) {
            outputContainerRef.current.scrollTop = outputContainerRef.current.scrollHeight;
        }
    }, [state.history]);

    // Separate the banner from regular history items
    const bannerItems = state.history.filter(item => item.type === 'banner');
    const nonBannerItems = state.history.filter(item => item.type !== 'banner');

    return (
        <div
            className="terminal-shell"
            onClick={() => promptRef.current?.focus()}
            style={{
                margin: '0',
                width: '100%',
                height: 'calc(100vh - 40px)',
                backgroundColor: 'transparent',
                color: '#E6E0D2',
                padding: '0',
                fontFamily: "'Courier New', Courier, monospace",
                boxSizing: 'border-box',
                maxWidth: '1200000px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Fixed ASCII Banner Area */}
            <div style={{ flexShrink: 0, padding: '2rem 2rem 0 2rem' }}>
                <Output history={bannerItems} />
            </div>

            {/* Scrollable Command Text Area */}
            <div
                ref={outputContainerRef}
	                onScroll={handleScroll}
		                style={{
		                    flex: 1,
		                    overflowY: 'auto',
		                    overflowX: 'hidden',
		                    overscrollBehavior: 'contain',
		                    padding: '0',
		                    backgroundColor: 'transparent',
		                    borderRadius: '0',
		                    border: 'none',
		                    marginTop: '0',
		                    marginLeft: '2rem',
		                    marginRight: '2rem',
		                    marginBottom: '2rem',
		                    position: 'relative',
		                }}
		            >
	                {/* Sticky top cutoff line to visually clip scrolled text */}
	                <div
	                    style={{
	                        position: 'sticky',
	                        top: 0,
	                        zIndex: 10,
	                        height: '10px',
	                        backgroundColor: 'var(--color-bg)',
	                        pointerEvents: 'none',
	                    }}
	                >
	                    <div
	                        style={{
	                            position: 'absolute',
	                            left: '1rem',
	                            right: '1rem',
	                            top: 0,
	                            height: '1px',
	                            backgroundColor: 'rgba(42, 45, 46, 0.6)',
	                            pointerEvents: 'none',
	                        }}
	                    />
	                </div>

                <div style={{ padding: '1rem' }}>
                    {/* Command history and prompt scroll together */}
                    <Output history={nonBannerItems} />
                    <Prompt
                        ref={promptRef}
                        value={input}
                        path={state.currentCwd}
                        onChange={(val) => {
                            setHistoryPointer(null);
                            setInput(val);
                        }}
                        onSubmit={handleSubmit}
                        onHistory={handleHistory}
                        onTabComplete={handleTabComplete}
                        onToggleCheatSheet={() => setIsCheatSheetOpen((v) => !v)}
                        showPlaceholder={state.commandHistory.length === 0}
                        ghostSuffix={autocomplete.ghostSuffix}
                        suggestions={autocomplete.suggestions.map((s) => ({
                            label: s.label,
                            kind: s.kind,
                        }))}
                    />

                    {helpWizardStep === 'none' && !hasUsedOpen && input.trim() === '' && tryChips.length > 0 && (
                        <div
                            style={{
                                marginTop: '0.6rem',
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                            }}
                        >
                            <span style={{ color: '#B7B0A2', opacity: 0.55 }}>Try:</span>
                            {tryChips.map((chip, idx) => (
                                <React.Fragment key={chip.command}>
                                    <span
                                        style={{
                                            color: '#B7B0A2',
                                            opacity: 0.55,
                                            userSelect: 'text',
                                            whiteSpace: 'pre',
                                        }}
                                    >
                                        {chip.label}
                                    </span>
                                    {idx < tryChips.length - 1 && (
                                        <span style={{ color: '#B7B0A2', opacity: 0.35 }} aria-hidden="true">
                                            ·
                                        </span>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Help / cheat sheet toggle */}
            <button
                type="button"
                aria-label="Quick help"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsCheatSheetOpen((v) => !v);
                }}
                style={{
                    position: 'fixed',
                    right: '18px',
                    bottom: '18px',
                    zIndex: 50,
                    width: '38px',
                    height: '38px',
                    borderRadius: '999px',
                    border: '1px solid rgba(230, 224, 210, 0.14)',
                    background: 'rgba(0, 0, 0, 0.18)',
                    color: '#E6E0D2',
                    fontFamily: 'monospace',
                    fontSize: '16px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(6px)',
                }}
            >
                ?
            </button>

            {isCheatSheetOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Quick help"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsCheatSheetOpen(false);
                        window.requestAnimationFrame(() => promptRef.current?.focus());
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 60,
                        background: 'rgba(0, 0, 0, 0.45)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-end',
                        padding: '18px',
                    }}
                >
                    <div
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        style={{
                            width: 'min(520px, calc(100vw - 36px))',
                            background: 'rgba(16, 18, 18, 0.92)',
                            border: '1px solid rgba(230, 224, 210, 0.10)',
                            borderRadius: '14px',
                            padding: '14px 14px 12px 14px',
                            color: '#E6E0D2',
                            fontFamily: 'monospace',
                            boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                            <div>
                                <div style={{ color: '#B08D57', fontWeight: 700, letterSpacing: '0.04em' }}>QUICK HELP</div>
                                <div style={{ color: '#B7B0A2', opacity: 0.8, fontSize: '12px', marginTop: '2px' }}>
                                    Press <span style={{ color: '#E6E0D2' }}>Esc</span> to close · Press <span style={{ color: '#E6E0D2' }}>?</span> on an empty prompt to toggle
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label="Close quick help"
                                onClick={() => {
                                    setIsCheatSheetOpen(false);
                                    window.requestAnimationFrame(() => promptRef.current?.focus());
                                }}
                                style={{
                                    cursor: 'pointer',
                                    border: '1px solid rgba(230, 224, 210, 0.12)',
                                    borderRadius: '10px',
                                    padding: '6px 10px',
                                    background: 'rgba(0, 0, 0, 0.12)',
                                    color: '#E6E0D2',
                                    fontFamily: 'monospace',
                                }}
                            >
                                Esc
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.45rem 0.75rem', fontSize: '13px' }}>
                            <span style={{ color: '#B08D57' }}>ls</span>
                            <span style={{ color: '#B7B0A2' }}>List files/folders here</span>

                            <span style={{ color: '#B08D57' }}>cd &lt;dir&gt;</span>
                            <span style={{ color: '#B7B0A2' }}>Move around (also: <span style={{ color: '#E6E0D2' }}>cd ..</span>, <span style={{ color: '#E6E0D2' }}>cd /</span>)</span>

                            <span style={{ color: '#B08D57' }}>open &lt;file|dir&gt;</span>
                            <span style={{ color: '#B7B0A2' }}>Open a chapter or step into a folder</span>

                            <span style={{ color: '#B08D57' }}>cat &lt;file&gt;</span>
                            <span style={{ color: '#B7B0A2' }}>Read a file without changing location</span>

                            <span style={{ color: '#B08D57' }}>search &lt;term&gt;</span>
                            <span style={{ color: '#B7B0A2' }}>Find chapters by name/tags</span>

                            <span style={{ color: '#B08D57' }}>tree -L 2</span>
                            <span style={{ color: '#B7B0A2' }}>Show structure (change depth)</span>

                            <span style={{ color: '#B08D57' }}>home / back</span>
                            <span style={{ color: '#B7B0A2' }}>Go to start / previous place</span>

                            <span style={{ color: '#B08D57' }}>clear</span>
                            <span style={{ color: '#B7B0A2' }}>Clear conversation (keeps banner)</span>
                        </div>

                        <div style={{ marginTop: '0.75rem', color: '#B7B0A2', opacity: 0.75, fontSize: '12px' }}>
                            Tip: Tab autocompletes commands and paths.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
