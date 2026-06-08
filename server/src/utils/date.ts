export const getShanghaiStartOfDay = (date?: Date | string): Date => {
  const d = date ? new Date(date) : new Date();
  d.setMilliseconds(0);
  const shanghaiStr = d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
  const shanghaiTime = new Date(shanghaiStr);
  shanghaiTime.setHours(0, 0, 0, 0);

  const localTimeInMs = d.getTime();
  const shanghaiTimeInMs = new Date(shanghaiStr).getTime();
  const diff = shanghaiTimeInMs - localTimeInMs;

  return new Date(shanghaiTime.getTime() - diff);
};

export const getShanghaiEndOfDay = (date?: Date | string): Date => {
  const d = date ? new Date(date) : new Date();
  d.setMilliseconds(0);
  const shanghaiStr = d.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
  const shanghaiTime = new Date(shanghaiStr);
  shanghaiTime.setHours(23, 59, 59, 999);

  const localTimeInMs = d.getTime();
  const shanghaiTimeInMs = new Date(shanghaiStr).getTime();
  const diff = shanghaiTimeInMs - localTimeInMs;

  return new Date(shanghaiTime.getTime() - diff);
};
