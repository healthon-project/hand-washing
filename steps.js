/**
 * Handwashing 6-Step Data & Zone Verification Module
 */
const HANDWASHING_STEPS = {
    1: {
        id: 1,
        title: '1단계: 손바닥과 손바닥을 마주대고 문질러요',
        shortTitle: '1단계: 손바닥 닦기',
        desc: '손바닥 중앙과 기본 면의 세균을 쓱쓱 문질러 지우세요.',
        targetZone: 'palm',
        targetLabel: '손바닥',
        requiredView: 'palm',
        hintMsg: '손바닥 영역을 구석구석 문질러보세요!'
    },
    2: {
        id: 2,
        title: '2단계: 손등과 손바닥을 마주대고 문질러요',
        shortTitle: '2단계: 손등 닦기',
        desc: '손등 넓은 면을 쓱쓱 닦아 손등의 UV 형광 세균을 지우세요.',
        targetZone: 'back',
        targetLabel: '손등',
        requiredView: 'back',
        hintMsg: '손등 보기를 클릭하거나 손등 면을 넓게 닦으세요!'
    },
    3: {
        id: 3,
        title: '3단계: 손깍지를 끼고 손가락 사이를 문질러요',
        shortTitle: '3단계: 손가락 사이 닦기',
        desc: '손가락 사이 사이(손깍지 공간) 틈새 오염을 정밀하게 닦아내세요.',
        targetZone: 'webbing',
        targetLabel: '손가락 사이',
        requiredView: 'both',
        hintMsg: '손가락 틈새(손깍지 공간)를 정밀하게 닦으세요!'
    },
    4: {
        id: 4,
        title: '4단계: 두 손을 모아 손가락을 문질러요',
        shortTitle: '4단계: 두 손 모아 닦기',
        desc: '손가락 마디 뒷면과 굽혀지는 부분을 집중적으로 문지릅니다.',
        targetZone: 'knuckles',
        targetLabel: '손가락 마디',
        requiredView: 'back',
        hintMsg: '손가락 관절 마디 부위를 문지르세요!'
    },
    5: {
        id: 5,
        title: '5단계: 엄지손가락을 다른 편 손바닥으로 돌려주며 문질러요',
        shortTitle: '5단계: 엄지손가락 닦기',
        desc: '오염되기 쉬운 엄지손가락 전체를 돌려가며 닦아주세요.',
        targetZone: 'thumb',
        targetLabel: '엄지손가락',
        requiredView: 'both',
        hintMsg: '엄지손가락 영역을 집중적으로 돌려 닦으세요!'
    },
    6: {
        id: 6,
        title: '6단계: 손톱을 반대편 손바닥에 문질러 세균을 지워요',
        shortTitle: '6단계: 손톱 밑 닦기',
        desc: '세균이 90% 집중되는 손톱 밑! 손가락 끝을 꼼꼼하게 문지르세요.',
        targetZone: 'nails',
        targetLabel: '손톱 밑',
        requiredView: 'both',
        hintMsg: '손가락 맨 끝(손톱 밑)을 꼼꼼히 문질러 지우세요!'
    },
    7: {
        id: 7,
        title: '7단계: 손목까지 돌려서 깨끗하게 씻어요',
        shortTitle: '7단계: 손목 씻기',
        desc: '손씻기의 완성! 손목 아래쪽 부위를 깨끗하게 둘러가며 닦아줍니다.',
        targetZone: 'wrist',
        targetLabel: '손목',
        requiredView: 'both',
        hintMsg: '손목 부위 아래쪽을 깨끗이 문지르세요!'
    }
};

/**
 * Get step ID corresponding to target zone
 */
function getStepIdForZone(zoneKey) {
    switch (zoneKey) {
        case 'palm': return 1;
        case 'back': return 2;
        case 'webbing': return 3;
        case 'knuckles': return 4;
        case 'thumb': return 5;
        case 'nails': return 6;
        case 'wrist': return 7;
        default: return 1;
    }
}

/**
 * Check if the active step allows cleaning a specific target zone
 */
function isZoneAllowedInStep(zoneKey, currentStepId, easyMode = true) {
    // In Easy Mode, ALL zones are allowed to be scrubbed freely!
    if (easyMode) return true;

    const stepConfig = HANDWASHING_STEPS[currentStepId];
    if (!stepConfig) return false;

    if (currentStepId === 1 && zoneKey === 'palm') return true;
    if (currentStepId === 2 && zoneKey === 'back') return true;
    if (currentStepId === 3 && zoneKey === 'webbing') return true;
    if (currentStepId === 4 && zoneKey === 'knuckles') return true;
    if (currentStepId === 5 && zoneKey === 'thumb') return true;
    if (currentStepId === 6 && zoneKey === 'nails') return true;
    if (currentStepId === 7 && zoneKey === 'wrist') return true;

    return false;
}

/**
 * Get warning message when user rubs a zone without selecting its proper step
 */
function getStepWarningMessage(zoneKey) {
    switch (zoneKey) {
        case 'nails':
            return '⚠️ 손톱 밑 세균은 [6단계: 손톱 밑 닦기]를 선택해야 지워집니다!';
        case 'thumb':
            return '⚠️ 엄지손가락 세균은 [5단계: 엄지 닦기]를 선택해야 지워집니다!';
        case 'webbing':
            return '⚠️ 손가락 사이 세균은 [3단계: 손가락 사이]를 선택해야 지워집니다!';
        case 'knuckles':
            return '⚠️ 손가락 마디 세균은 [4단계: 두 손 모아 닦기]를 선택해야 지워집니다!';
        case 'back':
            return '⚠️ 손등 세균은 [2단계: 손등 닦기]를 선택해야 지워집니다!';
        case 'wrist':
            return '⚠️ 손목 세균은 [보너스: 손목 씻기]를 선택해야 지워집니다!';
        default:
            return '⚠️ 해당 영역에 맞는 올바른 손씻기 단계를 선택해주세요!';
    }
}
